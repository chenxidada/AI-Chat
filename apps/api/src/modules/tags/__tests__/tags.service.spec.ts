import { Test, TestingModule } from '@nestjs/testing';
import { TagsService } from '../tags.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { createMockPrismaService, mockData } from '../../../../test/test-utils';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('TagsService', () => {
  let service: TagsService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagsService,
        {
          provide: PrismaService,
          useValue: createMockPrismaService(),
        },
      ],
    }).compile();

    service = module.get<TagsService>(TagsService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a tag', async () => {
      const createDto = { name: 'new-tag', color: '#ff0000' };
      const mockTag = mockData.tag(createDto);

      prisma.tag.create.mockResolvedValue(mockTag);

      const result = await service.create(createDto);

      expect(prisma.tag.create).toHaveBeenCalledWith({
        data: {
          name: createDto.name,
          color: createDto.color,
        },
        include: {
          _count: {
            select: { documents: true },
          },
        },
      });
      expect(result.name).toBe('new-tag');
    });

    it('should throw ConflictException if tag name exists', async () => {
      const createDto = { name: 'existing-tag' };
      const error = { code: 'P2002' };
      prisma.tag.create.mockRejectedValue(error);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all tags', async () => {
      const mockTags = [
        { ...mockData.tag({ id: 'tag-1', name: 'tag1' }), _count: { documents: 2 } },
        { ...mockData.tag({ id: 'tag-2', name: 'tag2' }), _count: { documents: 1 } },
      ];

      prisma.tag.findMany.mockResolvedValue(mockTags);

      const result = await service.findAll();

      expect(prisma.tag.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { documents: true },
          },
        },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('should update a tag', async () => {
      const updateDto = { name: 'updated-tag', color: '#00ff00' };
      const mockTag = mockData.tag(updateDto);

      prisma.tag.findUnique.mockResolvedValue(mockData.tag({ id: 'tag-123' }));
      prisma.tag.update.mockResolvedValue(mockTag);

      const result = await service.update('tag-123', updateDto);

      expect(prisma.tag.update).toHaveBeenCalledWith({
        where: { id: 'tag-123' },
        data: updateDto,
        include: {
          _count: {
            select: { documents: true },
          },
        },
      });
      expect(result.name).toBe('updated-tag');
    });

    it('should throw NotFoundException if tag not found', async () => {
      const updateDto = { name: 'test' };
      prisma.tag.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent', updateDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a tag', async () => {
      const mockTag = mockData.tag({ id: 'tag-123' });
      prisma.tag.findUnique.mockResolvedValue(mockTag);
      prisma.tag.delete.mockResolvedValue(mockTag);

      await service.remove('tag-123');

      expect(prisma.tag.delete).toHaveBeenCalledWith({
        where: { id: 'tag-123' },
      });
    });

    it('should throw NotFoundException if tag not found on delete', async () => {
      prisma.tag.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
