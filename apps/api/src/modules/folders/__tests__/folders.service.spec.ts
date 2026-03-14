import { Test, TestingModule } from '@nestjs/testing';
import { FoldersService } from '../folders.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { createMockPrismaService, mockData } from '../../../../test/test-utils';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('FoldersService', () => {
  let service: FoldersService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FoldersService,
        {
          provide: PrismaService,
          useValue: createMockPrismaService(),
        },
      ],
    }).compile();

    service = module.get<FoldersService>(FoldersService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a root folder', async () => {
      const createDto = { name: 'New Folder' };
      const mockFolder = mockData.folder({ name: 'New Folder' });

      prisma.folder.findFirst.mockResolvedValue(null); // No duplicate name
      prisma.folder.create.mockResolvedValue(mockFolder);

      const result = await service.create(createDto);

      expect(prisma.folder.create).toHaveBeenCalledWith({
        data: {
          name: 'New Folder',
          parentId: null,
          sortOrder: 0,
        },
        include: {
          _count: {
            select: { documents: true },
          },
        },
      });
      expect(result.name).toBe('New Folder');
    });

    it('should create a nested folder', async () => {
      const createDto = { name: 'Nested Folder', parentId: 'parent-123' };
      const mockFolder = mockData.folder({ parentId: 'parent-123' });

      prisma.folder.findUnique.mockResolvedValue(mockData.folder({ id: 'parent-123' }));
      prisma.folder.findFirst.mockResolvedValue(null);
      prisma.folder.create.mockResolvedValue(mockFolder);

      const result = await service.create(createDto);

      expect(result.parentId).toBe('parent-123');
    });

    it('should throw NotFoundException if parent not found', async () => {
      const createDto = { name: 'Nested Folder', parentId: 'non-existent' };
      prisma.folder.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTree', () => {
    it('should return folder tree structure', async () => {
      const mockFolders = [
        mockData.folder({ id: 'folder-1', parentId: null }),
        mockData.folder({ id: 'folder-2', parentId: 'folder-1' }),
      ];

      prisma.folder.findMany.mockResolvedValue(mockFolders);

      const result = await service.getTree();

      expect(prisma.folder.findMany).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('findOne', () => {
    it('should return a folder by id', async () => {
      const mockFolder = mockData.folder({ id: 'folder-123' });
      prisma.folder.findUnique.mockResolvedValue(mockFolder);

      const result = await service.findOne('folder-123');

      expect(prisma.folder.findUnique).toHaveBeenCalledWith({
        where: { id: 'folder-123' },
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
      expect(result).toEqual(mockFolder);
    });

    it('should throw NotFoundException if folder not found', async () => {
      prisma.folder.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a folder name', async () => {
      const updateDto = { name: 'Updated Name' };
      const mockFolder = mockData.folder({ id: 'folder-123', name: 'Updated Name' });

      prisma.folder.findUnique.mockResolvedValue(mockData.folder({ id: 'folder-123' }));
      prisma.folder.findFirst.mockResolvedValue(null);
      prisma.folder.update.mockResolvedValue(mockFolder);

      const result = await service.update('folder-123', updateDto);

      expect(prisma.folder.update).toHaveBeenCalledWith({
        where: { id: 'folder-123' },
        data: { name: 'Updated Name' },
        include: {
          _count: {
            select: { documents: true },
          },
        },
      });
      expect(result.name).toBe('Updated Name');
    });

    it('should update folder sortOrder', async () => {
      const updateDto = { sortOrder: 5 };
      const mockFolder = mockData.folder({ id: 'folder-123', sortOrder: 5 });

      prisma.folder.findUnique.mockResolvedValue(mockData.folder({ id: 'folder-123' }));
      prisma.folder.update.mockResolvedValue(mockFolder);

      const result = await service.update('folder-123', updateDto);

      expect(result.sortOrder).toBe(5);
    });

    it('should throw BadRequestException for self-reference', async () => {
      const updateDto = { parentId: 'folder-123' };
      prisma.folder.findUnique.mockResolvedValue(mockData.folder({ id: 'folder-123' }));

      await expect(service.update('folder-123', updateDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should delete a folder', async () => {
      const mockFolder = mockData.folder({ id: 'folder-123' });
      prisma.folder.findUnique.mockResolvedValue(mockFolder);
      prisma.folder.findMany.mockResolvedValue([]); // No children
      prisma.document.updateMany.mockResolvedValue({ count: 0 });
      prisma.folder.delete.mockResolvedValue(mockFolder);

      const result = await service.remove('folder-123');

      expect(prisma.folder.delete).toHaveBeenCalledWith({
        where: { id: 'folder-123' },
      });
      expect(result.id).toBe('folder-123');
    });
  });

  describe('togglePin', () => {
    it('should toggle pin to true', async () => {
      const mockFolder = mockData.folder({ id: 'folder-123', isPinned: false });
      prisma.folder.findUnique.mockResolvedValue(mockFolder);
      prisma.folder.update.mockResolvedValue({ ...mockFolder, isPinned: true });

      const result = await service.togglePin('folder-123');

      expect(result.isPinned).toBe(true);
    });

    it('should toggle pin to false', async () => {
      const mockFolder = mockData.folder({ id: 'folder-123', isPinned: true });
      prisma.folder.findUnique.mockResolvedValue(mockFolder);
      prisma.folder.update.mockResolvedValue({ ...mockFolder, isPinned: false });

      const result = await service.togglePin('folder-123');

      expect(result.isPinned).toBe(false);
    });
  });

  describe('reorder', () => {
    it('should reorder folders', async () => {
      const reorderDto = {
        items: [
          { id: 'folder-1', sortOrder: 1 },
          { id: 'folder-2', sortOrder: 2 },
        ],
      };

      prisma.$transaction.mockResolvedValue([{ id: 'folder-1' }, { id: 'folder-2' }]);

      const result = await service.reorder(reorderDto);

      expect(result.updated).toBe(2);
    });
  });
});
