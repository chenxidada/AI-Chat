import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { ReorderFoldersDto } from './dto/reorder-folders.dto';

@Injectable()
export class FoldersService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── 获取树形结构 ─────────────────────────────────────────────────────────────

  async getTree() {
    const folders = await this.prisma.folder.findMany({
      include: {
        _count: {
          select: { documents: true },
        },
      },
      orderBy: [
        { isPinned: 'desc' },
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    });

    return this.buildTree(folders, null);
  }

  // ─── 获取单个文件夹 ────────────────────────────────────────────────────────────

  async findOne(id: string) {
    const folder = await this.prisma.folder.findUnique({
      where: { id },
      include: {
        children: {
          include: {
            _count: {
              select: { documents: true },
            },
          },
          orderBy: [
            { isPinned: 'desc' },
            { sortOrder: 'asc' },
            { name: 'asc' },
          ],
        },
        _count: {
          select: { documents: true },
        },
      },
    });

    if (!folder) {
      throw new NotFoundException(`文件夹 ${id} 不存在`);
    }

    return folder;
  }

  // ─── 创建文件夹 ────────────────────────────────────────────────────────────────

  async create(dto: CreateFolderDto) {
    // 检查父文件夹是否存在
    if (dto.parentId) {
      const parent = await this.prisma.folder.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException(`父文件夹 ${dto.parentId} 不存在`);
      }

      // 检查嵌套深度（父文件夹深度 + 1 <= 5）
      const parentDepth = await this.getDepth(dto.parentId);
      if (parentDepth + 1 > 5) {
        throw new BadRequestException('文件夹嵌套深度不能超过 5 层');
      }
    }

    // 检查同级重名
    await this.checkDuplicateName(dto.name, dto.parentId ?? null, null);

    return this.prisma.folder.create({
      data: {
        name: dto.name,
        parentId: dto.parentId ?? null,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: {
        _count: {
          select: { documents: true },
        },
      },
    });
  }

  // ─── 更新文件夹 ────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateFolderDto) {
    const folder = await this.prisma.folder.findUnique({ where: { id } });
    if (!folder) {
      throw new NotFoundException(`文件夹 ${id} 不存在`);
    }

    // 若更改了 parentId，需检查循环引用
    if (dto.parentId !== undefined && dto.parentId !== folder.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException('文件夹不能将自身设为父文件夹');
      }

      if (dto.parentId) {
        // 检查目标父文件夹是否是当前文件夹的子孙
        const descendantIds = await this.getDescendantIds(id);
        if (descendantIds.includes(dto.parentId)) {
          throw new BadRequestException('不能将文件夹移动到其子孙文件夹中');
        }

        // 检查父文件夹是否存在
        const parent = await this.prisma.folder.findUnique({
          where: { id: dto.parentId },
        });
        if (!parent) {
          throw new NotFoundException(`父文件夹 ${dto.parentId} 不存在`);
        }

        // 检查嵌套深度
        const parentDepth = await this.getDepth(dto.parentId);
        if (parentDepth + 1 > 5) {
          throw new BadRequestException('文件夹嵌套深度不能超过 5 层');
        }
      }
    }

    // 检查同级重名（排除自身）
    const newName = dto.name ?? folder.name;
    const newParentId =
      dto.parentId !== undefined ? (dto.parentId ?? null) : folder.parentId;
    await this.checkDuplicateName(newName, newParentId, id);

    return this.prisma.folder.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId ?? null }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
      include: {
        _count: {
          select: { documents: true },
        },
      },
    });
  }

  // ─── 删除文件夹 ────────────────────────────────────────────────────────────────

  async remove(id: string) {
    const folder = await this.prisma.folder.findUnique({ where: { id } });
    if (!folder) {
      throw new NotFoundException(`文件夹 ${id} 不存在`);
    }

    // 获取所有子孙文件夹 ID（含自身）
    const descendantIds = await this.getDescendantIds(id);
    const allIds = [id, ...descendantIds];

    // 将这些文件夹下的文档 folderId 置 null
    await this.prisma.document.updateMany({
      where: { folderId: { in: allIds } },
      data: { folderId: null },
    });

    // 删除文件夹（Cascade 处理子文件夹）
    await this.prisma.folder.delete({ where: { id } });

    return { id };
  }

  // ─── 批量重排序 ───────────────────────────────────────────────────────────────

  async reorder(dto: ReorderFoldersDto) {
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.folder.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );

    return { updated: dto.items.length };
  }

  // ─── 切换置顶状态 ────────────────────────────────────────────────────────────────

  async togglePin(id: string) {
    const folder = await this.prisma.folder.findUnique({
      where: { id },
      select: { isPinned: true },
    });

    if (!folder) {
      throw new NotFoundException(`文件夹 ${id} 不存在`);
    }

    const updated = await this.prisma.folder.update({
      where: { id },
      data: { isPinned: !folder.isPinned },
    });

    return { isPinned: updated.isPinned };
  }

  // ─── 辅助方法 ──────────────────────────────────────────────────────────────────

  /**
   * 递归构建树形结构
   */
  private buildTree(folders: any[], parentId: string | null): any[] {
    return folders
      .filter((f) => f.parentId === parentId)
      .map((f) => ({
        ...f,
        children: this.buildTree(folders, f.id),
      }));
  }

  /**
   * 获取指定文件夹的深度（根文件夹深度为 1）
   */
  private async getDepth(folderId: string): Promise<number> {
    let depth = 0;
    let currentId: string | null = folderId;

    while (currentId) {
      depth++;
      const found: { parentId: string | null } | null =
        await this.prisma.folder.findUnique({
          where: { id: currentId },
          select: { parentId: true },
        });
      currentId = found?.parentId ?? null;
    }

    return depth;
  }

  /**
   * 获取指定文件夹的所有子孙文件夹 ID（不含自身）
   */
  private async getDescendantIds(folderId: string): Promise<string[]> {
    const result: string[] = [];
    const queue: string[] = [folderId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = await this.prisma.folder.findMany({
        where: { parentId: currentId },
        select: { id: true },
      });

      for (const child of children) {
        result.push(child.id);
        queue.push(child.id);
      }
    }

    return result;
  }

  /**
   * 检查同级下是否存在同名文件夹（excludeId 为排除自身）
   */
  private async checkDuplicateName(
    name: string,
    parentId: string | null,
    excludeId: string | null,
  ): Promise<void> {
    const existing = await this.prisma.folder.findFirst({
      where: {
        name,
        parentId: parentId ?? null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    if (existing) {
      throw new BadRequestException(
        `同级下已存在名为"${name}"的文件夹`,
      );
    }
  }
}
