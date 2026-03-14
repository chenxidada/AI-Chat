import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { PdfUploadResult } from './dto/pdf.dto';

// 动态导入 pdf-parse (ESM 模块兼容)
let pdfParse: any;
try {
  pdfParse = require('pdf-parse');
} catch (e) {
  console.warn('pdf-parse not loaded');
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private readonly pdfDir = path.join(process.cwd(), 'uploads', 'pdfs');
  private readonly thumbnailDir = path.join(process.cwd(), 'uploads', 'thumbnails');

  constructor(private readonly prisma: PrismaService) {
    // 确保上传目录存在
    [this.pdfDir, this.thumbnailDir].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * 上传单个 PDF 文件
   */
  async uploadPdf(
    file: Express.Multer.File,
    documentId?: string,
  ): Promise<PdfUploadResult> {
    try {
      const filePath = file.path;
      const url = `/uploads/pdfs/${file.filename}`;

      // 提取 PDF 信息
      const pdfInfo = await this.extractPdfInfo(filePath);

      // 生成缩略图
      const thumbnailUrl = await this.generateThumbnail(filePath, file.filename);

      const pdf = await this.prisma.pdfFile.create({
        data: {
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          url,
          pageCount: pdfInfo.pageCount,
          extractedText: pdfInfo.text,
          thumbnailUrl,
          documentId: documentId || null,
        },
      });

      return {
        id: pdf.id,
        originalName: pdf.originalName,
        size: pdf.size,
        pageCount: pdf.pageCount,
        url: pdf.url,
        thumbnailUrl: pdf.thumbnailUrl || undefined,
      };
    } catch (error) {
      this.logger.error(`PDF 上传失败: ${error.message}`);
      // 清理已上传的文件
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw new BadRequestException(`PDF 上传失败: ${error.message}`);
    }
  }

  /**
   * 批量上传 PDF 文件
   */
  async uploadBatch(
    files: Express.Multer.File[],
    documentId?: string,
  ): Promise<PdfUploadResult[]> {
    const results: PdfUploadResult[] = [];

    for (const file of files) {
      try {
        const result = await this.uploadPdf(file, documentId);
        results.push(result);
      } catch (error) {
        results.push({
          id: '',
          originalName: file.originalname,
          size: file.size,
          pageCount: 0,
          url: '',
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * 提取 PDF 信息（页数、文本内容）
   */
  private async extractPdfInfo(
    filePath: string,
  ): Promise<{ pageCount: number; text: string }> {
    try {
      if (!pdfParse) {
        this.logger.warn('pdf-parse 未加载，跳过文本提取');
        return { pageCount: 0, text: '' };
      }

      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);

      // 限制文本长度，避免数据库字段过大
      const maxTextLength = 100000;
      const text = data.text?.slice(0, maxTextLength) || '';

      this.logger.log(`PDF 提取完成: ${data.numpages} 页, ${text.length} 字符`);

      return {
        pageCount: data.numpages || 0,
        text,
      };
    } catch (error) {
      this.logger.warn(`PDF 信息提取失败: ${error.message}`);
      return { pageCount: 0, text: '' };
    }
  }

  /**
   * 生成 PDF 缩略图（第一页）
   */
  private async generateThumbnail(
    pdfPath: string,
    filename: string,
  ): Promise<string | null> {
    try {
      // 使用 pdf-parse 获取第一页渲染
      // 由于 pdf-parse 不支持渲染，我们使用 canvas 和 pdf.js
      // 这里提供一个简化的实现，实际项目中可能需要使用 pdf2pic 或 poppler

      // 检查是否安装了相关工具
      const thumbnailFilename = `${path.parse(filename).name}.png`;
      const thumbnailPath = path.join(this.thumbnailDir, thumbnailFilename);

      // 尝试使用 sharp 创建一个占位缩略图
      // 实际生产环境应使用 pdf2pic 或类似库
      const placeholderSvg = `
        <svg width="200" height="280" xmlns="http://www.w3.org/2000/svg">
          <rect width="200" height="280" fill="#f5f5f5"/>
          <rect x="10" y="10" width="180" height="260" fill="white" stroke="#ddd"/>
          <text x="100" y="140" text-anchor="middle" font-family="Arial" font-size="14" fill="#666">PDF</text>
          <text x="100" y="160" text-anchor="middle" font-family="Arial" font-size="10" fill="#999">Preview</text>
        </svg>
      `;

      await sharp(Buffer.from(placeholderSvg))
        .resize(200, 280)
        .png()
        .toFile(thumbnailPath);

      const thumbnailUrl = `/uploads/thumbnails/${thumbnailFilename}`;
      this.logger.log(`缩略图生成完成: ${thumbnailUrl}`);

      return thumbnailUrl;
    } catch (error) {
      this.logger.warn(`缩略图生成失败: ${error.message}`);
      return null;
    }
  }

  /**
   * 获取 PDF 列表
   */
  async findAll(dto: { page?: number; limit?: number; documentId?: string; search?: string }) {
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (dto.documentId) {
      where.documentId = dto.documentId;
    }

    if (dto.search) {
      where.extractedText = {
        contains: dto.search,
        mode: 'insensitive',
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.pdfFile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          originalName: true,
          size: true,
          pageCount: true,
          url: true,
          thumbnailUrl: true,
          documentId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.pdfFile.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 获取单个 PDF 详情
   */
  async findOne(id: string) {
    const pdf = await this.prisma.pdfFile.findUnique({ where: { id } });

    if (!pdf) {
      throw new NotFoundException('PDF 文件不存在');
    }

    return pdf;
  }

  /**
   * 获取 PDF 文件路径（用于在线浏览）
   */
  async getFilePath(id: string): Promise<string> {
    const pdf = await this.findOne(id);
    const filePath = path.join(this.pdfDir, pdf.filename);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('PDF 文件不存在');
    }

    return filePath;
  }

  /**
   * 更新 PDF 信息
   */
  async update(id: string, data: { originalName?: string; documentId?: string }) {
    await this.findOne(id); // 检查是否存在

    return this.prisma.pdfFile.update({
      where: { id },
      data: {
        originalName: data.originalName,
        documentId: data.documentId,
      },
    });
  }

  /**
   * 删除 PDF
   */
  async remove(id: string) {
    const pdf = await this.findOne(id);

    // 删除 PDF 文件
    const pdfPath = path.join(this.pdfDir, pdf.filename);
    if (fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath);
    }

    // 删除缩略图
    if (pdf.thumbnailUrl) {
      const thumbnailFilename = path.basename(pdf.thumbnailUrl);
      const thumbnailPath = path.join(this.thumbnailDir, thumbnailFilename);
      if (fs.existsSync(thumbnailPath)) {
        fs.unlinkSync(thumbnailPath);
      }
    }

    // 删除数据库记录
    await this.prisma.pdfFile.delete({ where: { id } });

    return { id };
  }

  /**
   * 搜索 PDF 内容
   */
  async searchContent(query: string, limit: number = 20) {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const results = await this.prisma.pdfFile.findMany({
      where: {
        extractedText: {
          contains: query.trim(),
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        originalName: true,
        pageCount: true,
        thumbnailUrl: true,
        createdAt: true,
        extractedText: true,
      },
      take: limit,
    });

    return results.map((pdf) => ({
      id: pdf.id,
      originalName: pdf.originalName,
      pageCount: pdf.pageCount,
      thumbnailUrl: pdf.thumbnailUrl,
      createdAt: pdf.createdAt,
      textSnippet: this.extractTextSnippet(pdf.extractedText || '', query),
    }));
  }

  /**
   * 提取匹配文本的上下文片段
   */
  private extractTextSnippet(text: string, query: string, contextLength: number = 200): string {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);

    if (index === -1) {
      return text.slice(0, contextLength) + '...';
    }

    const start = Math.max(0, index - contextLength / 2);
    const end = Math.min(text.length, index + query.length + contextLength / 2);

    let snippet = text.slice(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';

    return snippet;
  }

  /**
   * 获取 PDF 统计信息
   */
  async getStats() {
    const [totalCount, totalSize, totalPages] = await Promise.all([
      this.prisma.pdfFile.count(),
      this.prisma.pdfFile.aggregate({
        _sum: { size: true },
      }),
      this.prisma.pdfFile.aggregate({
        _sum: { pageCount: true },
      }),
    ]);

    return {
      totalFiles: totalCount,
      totalSize: totalSize._sum.size || 0,
      totalPages: totalPages._sum.pageCount || 0,
    };
  }
}
