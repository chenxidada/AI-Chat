import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  Body,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { ImagesService } from './images.service';
import { ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';

@ApiTags('Images')
@Controller('v1/images')
export class ImagesController {
  constructor(private readonly imagesService: ImagesService) {}

  @Post('upload')
  @ApiOperation({ summary: '上传图片' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: path.join(process.cwd(), 'uploads', 'images'),
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname) || '.png';
          cb(null, `${uuidv4()}${ext}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('不支持的文件类型，仅允许 JPEG、PNG、GIF、WebP'), false);
        }
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('documentId') documentId?: string,
  ) {
    if (!file) {
      return { statusCode: HttpStatus.BAD_REQUEST, message: '未提供文件' };
    }

    const image = await this.imagesService.uploadImage(file, documentId);

    return {
      id: image.id,
      url: image.url,
      originalName: image.originalName,
      size: image.size,
      mimeType: image.mimeType,
    };
  }

  @Get()
  @ApiOperation({ summary: '查询文档关联的图片列表' })
  async findByDocument(@Query('documentId') documentId: string) {
    if (!documentId) {
      return [];
    }
    return this.imagesService.findByDocument(documentId);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除图片' })
  async remove(@Param('id') id: string) {
    const result = await this.imagesService.remove(id);
    if (!result) {
      throw new NotFoundException('图片不存在');
    }
    return { message: '已删除' };
  }
}
