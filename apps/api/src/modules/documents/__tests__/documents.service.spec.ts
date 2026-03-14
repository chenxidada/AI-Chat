import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsService } from '../documents.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CacheService } from '../../../common/cache/cache.service';
import { createMockPrismaService, mockData } from '../../../../test/test-utils';

// Mock CacheService
const createMockCacheService = () => ({
  get: jest.fn().mockResolvedValue(undefined),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
  reset: jest.fn().mockResolvedValue(undefined),
  getOrSet: jest.fn((key, factory) => factory()),
  isHealthy: jest.fn().mockReturnValue(true),
  isRedisConnected: jest.fn().mockReturnValue(false),
});

describe('DocumentsService', () => {
  let service: DocumentsService;
  let prisma: ReturnType<typeof createMockPrismaService>;
  let cacheService: ReturnType<typeof createMockCacheService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: PrismaService,
          useValue: createMockPrismaService(),
        },
        {
          provide: CacheService,
          useValue: createMockCacheService(),
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
    prisma = module.get(PrismaService);
    cacheService = module.get(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a document successfully', async () => {
      const createDto = {
        title: 'New Document',
        content: '# Hello World',
      };

      const mockDocument = mockData.document(createDto);
      mockDocument.tags = [];
      prisma.document.create.mockResolvedValue(mockDocument);

      const result = await service.create(createDto);

      expect(prisma.document.create).toHaveBeenCalled();
      expect(result.title).toBe('New Document');
    });

    it('should create a document in a folder', async () => {
      const createDto = {
        title: 'Nested Document',
        content: 'Content',
        folderId: 'folder-123',
      };

      const mockDocument = mockData.document(createDto);
      mockDocument.tags = [];
      prisma.document.create.mockResolvedValue(mockDocument);

      const result = await service.create(createDto);

      expect(result.folderId).toBe('folder-123');
    });
  });

  describe('findAll', () => {
    it('should return paginated documents', async () => {
      const mockDocuments = [
        { ...mockData.document({ id: 'doc-1' }), tags: [] },
        { ...mockData.document({ id: 'doc-2' }), tags: [] },
      ];

      prisma.document.findMany.mockResolvedValue(mockDocuments);
      prisma.document.count.mockResolvedValue(2);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
    });

    it('should filter by folderId', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);

      await service.findAll({ folderId: 'folder-123' });

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            folderId: 'folder-123',
          }),
        }),
      );
    });

    it('should filter by isArchived', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);

      await service.findAll({ isArchived: 'true' });

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isArchived: true,
          }),
        }),
      );
    });

    it('should filter by isFavorite', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);

      await service.findAll({ isFavorite: 'true' });

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isFavorite: true,
          }),
        }),
      );
    });

    it('should filter by isPinned', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      prisma.document.count.mockResolvedValue(0);

      await service.findAll({ isPinned: 'true' });

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isPinned: true,
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a document by id', async () => {
      const mockDocument = mockData.document({ id: 'doc-123' });
      mockDocument.tags = [];
      mockDocument.images = [];
      prisma.document.findUnique.mockResolvedValue(mockDocument);

      const result = await service.findOne('doc-123');

      expect(prisma.document.findUnique).toHaveBeenCalled();
      expect(result.id).toBe('doc-123');
    });

    it('should throw NotFoundException if document not found', async () => {
      prisma.document.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow('文档 non-existent 不存在');
    });
  });

  describe('update', () => {
    it('should update a document', async () => {
      const updateDto = {
        title: 'Updated Title',
        content: 'Updated content',
      };
      const existingDoc = mockData.document({ id: 'doc-123' });
      existingDoc.tags = [];

      const mockDocument = mockData.document({ ...updateDto, id: 'doc-123' });
      mockDocument.tags = [];

      prisma.document.findUnique.mockResolvedValue(existingDoc);
      prisma.document.update.mockResolvedValue(mockDocument);

      const result = await service.update('doc-123', updateDto);

      expect(prisma.document.update).toHaveBeenCalled();
      expect(result.title).toBe('Updated Title');
    });
  });

  describe('archive', () => {
    it('should archive a document', async () => {
      const mockDocument = mockData.document({ id: 'doc-123', isArchived: false });
      prisma.document.findUnique.mockResolvedValue(mockDocument);
      prisma.document.update.mockResolvedValue({ ...mockDocument, isArchived: true });

      const result = await service.archive('doc-123');

      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: 'doc-123' },
        data: { isArchived: true },
        select: { id: true, isArchived: true },
      });
      expect(result.isArchived).toBe(true);
    });
  });

  describe('removePermanent', () => {
    it('should permanently delete a document', async () => {
      const mockDocument = mockData.document({ id: 'doc-123' });
      prisma.document.findUnique.mockResolvedValue(mockDocument);
      prisma.document.delete.mockResolvedValue(mockDocument);

      await service.removePermanent('doc-123');

      expect(prisma.document.delete).toHaveBeenCalledWith({
        where: { id: 'doc-123' },
      });
    });
  });

  describe('toggleFavorite', () => {
    it('should toggle favorite to true', async () => {
      const mockDocument = mockData.document({ id: 'doc-123', isFavorite: false });
      prisma.document.findUnique
        .mockResolvedValueOnce(mockDocument)
        .mockResolvedValueOnce({ ...mockDocument, isFavorite: false });
      prisma.document.update.mockResolvedValue({ ...mockDocument, isFavorite: true });

      const result = await service.toggleFavorite('doc-123');

      expect(result.isFavorite).toBe(true);
    });

    it('should toggle favorite to false', async () => {
      const mockDocument = mockData.document({ id: 'doc-123', isFavorite: true });
      prisma.document.findUnique
        .mockResolvedValueOnce(mockDocument)
        .mockResolvedValueOnce({ ...mockDocument, isFavorite: true });
      prisma.document.update.mockResolvedValue({ ...mockDocument, isFavorite: false });

      const result = await service.toggleFavorite('doc-123');

      expect(result.isFavorite).toBe(false);
    });
  });

  describe('togglePin', () => {
    it('should toggle pin status', async () => {
      const mockDocument = mockData.document({ id: 'doc-123', isPinned: false });
      prisma.document.findUnique
        .mockResolvedValueOnce(mockDocument)
        .mockResolvedValueOnce({ ...mockDocument, isPinned: false });
      prisma.document.update.mockResolvedValue({ ...mockDocument, isPinned: true });

      const result = await service.togglePin('doc-123');

      expect(result.isPinned).toBe(true);
    });
  });

  describe('findFavorites', () => {
    it('should return all favorite documents', async () => {
      const mockFavorites = [
        { ...mockData.document({ id: 'doc-1', isFavorite: true }), tags: [], folder: null },
        { ...mockData.document({ id: 'doc-2', isFavorite: true }), tags: [], folder: null },
      ];

      prisma.document.findMany.mockResolvedValue(mockFavorites);
      prisma.document.count.mockResolvedValue(2);

      const result = await service.findFavorites({ page: 1, limit: 20 });

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isFavorite: true, isArchived: false },
        }),
      );
      expect(result.items).toHaveLength(2);
    });
  });

  describe('findRecent', () => {
    it('should return recent documents with pinned first', async () => {
      const mockDocs = [
        { ...mockData.document({ id: 'doc-1', isPinned: true }), tags: [] },
        { ...mockData.document({ id: 'doc-2', isPinned: false }), tags: [] },
      ];

      prisma.document.findMany.mockResolvedValue(mockDocs);

      const result = await service.findRecent(10);

      expect(prisma.document.findMany).toHaveBeenCalledWith({
        where: { isArchived: false },
        orderBy: [
          { isPinned: 'desc' },
          { updatedAt: 'desc' },
        ],
        take: 10,
        include: {
          tags: { include: { tag: true } },
          folder: { select: { id: true, name: true } },
        },
      });
    });
  });

  describe('duplicate', () => {
    it('should duplicate a document', async () => {
      const originalDoc = mockData.document({ id: 'doc-123', title: 'Original' });
      originalDoc.tags = [];
      const duplicatedDoc = mockData.document({ id: 'doc-456', title: 'Original (副本)' });
      duplicatedDoc.tags = [];

      prisma.document.findUnique.mockResolvedValue(originalDoc);
      prisma.document.create.mockResolvedValue(duplicatedDoc);

      const result = await service.duplicate('doc-123');

      expect(prisma.document.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Original (副本)',
            content: originalDoc.content,
          }),
        }),
      );
    });
  });
});
