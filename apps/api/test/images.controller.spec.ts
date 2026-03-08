import { Test, TestingModule } from '@nestjs/testing';
import { ImagesController } from '../src/modules/images/images.controller';
import { ImagesService } from '../src/modules/images/images.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('ImagesController', () => {
  let controller: ImagesController;
  let service: ImagesService;
  let prisma: PrismaService;

  const mockPrismaService = {
    documentImage: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'test-image.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('test'),
    size: 1024,
    destination: '',
    filename: 'test-uuid.jpg',
    path: '',
    stream: null as any,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImagesController],
      providers: [
        ImagesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    controller = module.get<ImagesController>(ImagesController);
    service = module.get<ImagesService>(ImagesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('upload', () => {
    it('should upload an image successfully', async () => {
      const mockImage = {
        id: 'test-uuid',
        filename: 'test-uuid.jpg',
        originalName: 'test-image.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
        url: '/uploads/images/test-uuid.jpg',
        documentId: null,
        createdAt: new Date(),
      };

      mockPrismaService.documentImage.create.mockResolvedValue(mockImage);

      const result = await controller.upload(mockFile);

      expect(result).toEqual({
        id: mockImage.id,
        url: mockImage.url,
        originalName: mockImage.originalName,
        size: mockImage.size,
        mimeType: mockImage.mimeType,
      });
    });

    it('should upload an image with documentId', async () => {
      const mockImage = {
        id: 'test-uuid',
        filename: 'test-uuid.jpg',
        originalName: 'test-image.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
        url: '/uploads/images/test-uuid.jpg',
        documentId: 'doc-uuid',
        createdAt: new Date(),
      };

      mockPrismaService.documentImage.create.mockResolvedValue(mockImage);

      const result = await controller.upload(mockFile, 'doc-uuid');

      expect(result).toBeDefined();
      expect(mockPrismaService.documentImage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            documentId: 'doc-uuid',
          }),
        }),
      );
    });

    it('should return error when no file provided', async () => {
      const result = await controller.upload(null as any);

      expect(result).toEqual({
        statusCode: 400,
        message: '未提供文件',
      });
    });
  });

  describe('findByDocument', () => {
    it('should return images for a document', async () => {
      const mockImages = [
        {
          id: 'img-1',
          filename: 'test-1.jpg',
          originalName: 'test-1.jpg',
          mimeType: 'image/jpeg',
          size: 1024,
          url: '/uploads/images/test-1.jpg',
          documentId: 'doc-uuid',
          createdAt: new Date(),
        },
      ];

      mockPrismaService.documentImage.findMany.mockResolvedValue(mockImages);

      const result = await controller.findByDocument('doc-uuid');

      expect(result).toEqual(mockImages);
    });

    it('should return empty array when no documentId provided', async () => {
      const result = await controller.findByDocument('');

      expect(result).toEqual([]);
    });
  });

  describe('remove', () => {
    it('should delete an image successfully', async () => {
      const mockImage = {
        id: 'img-uuid',
        filename: 'test.jpg',
        originalName: 'test.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
        url: '/uploads/images/test.jpg',
        documentId: null,
        createdAt: new Date(),
      };

      mockPrismaService.documentImage.findUnique.mockResolvedValue(mockImage);
      mockPrismaService.documentImage.delete.mockResolvedValue(mockImage);

      const result = await controller.remove('img-uuid');

      expect(result).toEqual({ message: '已删除' });
    });

    it('should throw NotFoundException when image not found', async () => {
      mockPrismaService.documentImage.findUnique.mockResolvedValue(null);

      await expect(controller.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
