import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BatchMoveDto } from './dto/batch-move.dto';
import { BatchTagDto } from './dto/batch-tag.dto';

export interface BatchResult {
  success: boolean;
  affected: number;
  errors?: string[];
}

@Injectable()
export class DocumentsBatchService {
  private readonly logger = new Logger(DocumentsBatchService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 批量移动文档
   */
  async batchMove(dto: BatchMoveDto): Promise<BatchResult> {
    const { documentIds, folderId } = dto;

    // 验证目标文件夹存在
    if (folderId) {
      const folder = await this.prisma.folder.findUnique({
        where: { id: folderId },
      });
      if (!folder) {
        throw new BadRequestException(`文件夹 ${folderId} 不存在`);
      }
    }

    try {
      const result = await this.prisma.document.updateMany({
        where: {
          id: { in: documentIds },
        },
        data: {
          folderId: folderId || null,
          updatedAt: new Date(),
        },
      });

      return {
        success: true,
        affected: result.count,
      };
    } catch (error) {
      this.logger.error('批量移动失败', error);
      return {
        success: false,
        affected: 0,
        errors: [error.message],
      };
    }
  }

  /**
   * 批量标签操作
   */
  async batchTag(dto: BatchTagDto): Promise<BatchResult> {
    const { documentIds, tagIds, mode } = dto;

    // 验证标签存在
    const tags = await this.prisma.tag.findMany({
      where: { id: { in: tagIds } },
    });
    if (tags.length !== tagIds.length) {
      throw new BadRequestException('部分标签不存在');
    }

    try {
      let affected = 0;

      for (const docId of documentIds) {
        if (mode === 'add') {
          // 添加标签（忽略已存在的）
          await this.prisma.documentTag.createMany({
            data: tagIds.map((tagId) => ({
              documentId: docId,
              tagId,
            })),
            skipDuplicates: true,
          });
          affected++;
        } else if (mode === 'remove') {
          // 移除标签
          await this.prisma.documentTag.deleteMany({
            where: {
              documentId: docId,
              tagId: { in: tagIds },
            },
          });
          affected++;
        } else if (mode === 'replace') {
          // 替换标签：先删除所有，再添加新的
          await this.prisma.$transaction([
            this.prisma.documentTag.deleteMany({
              where: { documentId: docId },
            }),
            this.prisma.documentTag.createMany({
              data: tagIds.map((tagId) => ({
                documentId: docId,
                tagId,
              })),
            }),
          ]);
          affected++;
        }
      }

      return {
        success: true,
        affected,
      };
    } catch (error) {
      this.logger.error('批量标签操作失败', error);
      return {
        success: false,
        affected: 0,
        errors: [error.message],
      };
    }
  }

  /**
   * 批量归档
   */
  async batchArchive(documentIds: string[]): Promise<BatchResult> {
    try {
      const result = await this.prisma.document.updateMany({
        where: { id: { in: documentIds } },
        data: {
          isArchived: true,
          updatedAt: new Date(),
        },
      });

      return {
        success: true,
        affected: result.count,
      };
    } catch (error) {
      this.logger.error('批量归档失败', error);
      return {
        success: false,
        affected: 0,
        errors: [error.message],
      };
    }
  }

  /**
   * 批量恢复
   */
  async batchRestore(documentIds: string[]): Promise<BatchResult> {
    try {
      const result = await this.prisma.document.updateMany({
        where: { id: { in: documentIds } },
        data: {
          isArchived: false,
          updatedAt: new Date(),
        },
      });

      return {
        success: true,
        affected: result.count,
      };
    } catch (error) {
      this.logger.error('批量恢复失败', error);
      return {
        success: false,
        affected: 0,
        errors: [error.message],
      };
    }
  }

  /**
   * 批量删除（永久删除）
   */
  async batchDelete(documentIds: string[]): Promise<BatchResult> {
    try {
      const result = await this.prisma.document.deleteMany({
        where: { id: { in: documentIds } },
      });

      return {
        success: true,
        affected: result.count,
      };
    } catch (error) {
      this.logger.error('批量删除失败', error);
      return {
        success: false,
        affected: 0,
        errors: [error.message],
      };
    }
  }
}
