import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ImagesService {
  private readonly logger = new Logger(ImagesService.name);

  constructor(private prisma: PrismaService) {}

  async uploadImage(
    file: Express.Multer.File,
    documentId?: string,
  ) {
    const url = `/uploads/images/${file.filename}`;

    const image = await this.prisma.documentImage.create({
      data: {
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url,
        documentId: documentId || null,
      },
    });

    return image;
  }

  async findByDocument(documentId: string) {
    return this.prisma.documentImage.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.documentImage.findUnique({ where: { id } });
  }

  async remove(id: string) {
    const image = await this.prisma.documentImage.findUnique({ where: { id } });
    if (!image) return null;

    // Delete file from filesystem
    try {
      const filePath = path.join(process.cwd(), 'uploads', 'images', image.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      this.logger.warn(`Failed to delete file: ${image.filename}`, err);
    }

    // Delete database record
    await this.prisma.documentImage.delete({ where: { id } });
    return image;
  }
}
