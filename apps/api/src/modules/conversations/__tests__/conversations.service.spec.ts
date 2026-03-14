import { Test, TestingModule } from '@nestjs/testing';
import { ConversationsService } from '../conversations.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { createMockPrismaService, mockData } from '../../../../test/test-utils';
import { NotFoundException } from '@nestjs/common';

describe('ConversationsService', () => {
  let service: ConversationsService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        {
          provide: PrismaService,
          useValue: createMockPrismaService(),
        },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a conversation with default values', async () => {
      const mockConversation = mockData.conversation({ title: '新对话' });
      prisma.conversation.create.mockResolvedValue(mockConversation);

      const result = await service.create({});

      expect(prisma.conversation.create).toHaveBeenCalledWith({
        data: {
          title: '新对话',
          mode: 'general',
          contextDocumentIds: [],
          contextFolderId: null,
          contextTagIds: [],
        },
      });
      expect(result.title).toBe('新对话');
    });

    it('should create a conversation with custom mode', async () => {
      const mockConversation = mockData.conversation({ mode: 'knowledge_base' });
      prisma.conversation.create.mockResolvedValue(mockConversation);

      const result = await service.create({ mode: 'knowledge_base' });

      expect(result.mode).toBe('knowledge_base');
    });
  });

  describe('findAll', () => {
    it('should return paginated conversations', async () => {
      const mockConversations = [
        { ...mockData.conversation({ id: 'conv-1' }), _count: { messages: 5 } },
        { ...mockData.conversation({ id: 'conv-2' }), _count: { messages: 3 } },
      ];

      prisma.conversation.findMany.mockResolvedValue(mockConversations);
      prisma.conversation.count.mockResolvedValue(2);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by isPinned', async () => {
      prisma.conversation.findMany.mockResolvedValue([]);
      prisma.conversation.count.mockResolvedValue(0);

      await service.findAll({ isPinned: true });

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isPinned: true,
          }),
        }),
      );
    });

    it('should filter by isStarred', async () => {
      prisma.conversation.findMany.mockResolvedValue([]);
      prisma.conversation.count.mockResolvedValue(0);

      await service.findAll({ isStarred: true });

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isStarred: true,
          }),
        }),
      );
    });

    it('should order by pinned and starred first', async () => {
      prisma.conversation.findMany.mockResolvedValue([]);
      prisma.conversation.count.mockResolvedValue(0);

      await service.findAll({});

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [
            { isPinned: 'desc' },
            { isStarred: 'desc' },
            { updatedAt: 'desc' },
          ],
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a conversation with messages', async () => {
      const mockConversation = mockData.conversation({ id: 'conv-123' });
      prisma.conversation.findUnique.mockResolvedValue(mockConversation);

      const result = await service.findOne('conv-123');

      expect(prisma.conversation.findUnique).toHaveBeenCalledWith({
        where: { id: 'conv-123' },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      expect(result).toEqual(mockConversation);
    });

    it('should throw NotFoundException if conversation not found', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update conversation title', async () => {
      const mockConversation = mockData.conversation({ id: 'conv-123', title: 'Updated Title' });
      prisma.conversation.findUnique.mockResolvedValue(mockData.conversation({ id: 'conv-123' }));
      prisma.conversation.update.mockResolvedValue(mockConversation);

      const result = await service.update('conv-123', { title: 'Updated Title' });

      expect(result.title).toBe('Updated Title');
    });
  });

  describe('remove', () => {
    it('should delete a conversation', async () => {
      const mockConversation = mockData.conversation({ id: 'conv-123' });
      prisma.conversation.findUnique.mockResolvedValue(mockConversation);
      prisma.conversation.delete.mockResolvedValue(mockConversation);

      const result = await service.remove('conv-123');

      expect(prisma.conversation.delete).toHaveBeenCalledWith({
        where: { id: 'conv-123' },
      });
      expect(result.id).toBe('conv-123');
    });
  });

  describe('togglePin', () => {
    it('should toggle pin to true', async () => {
      const mockConversation = mockData.conversation({ id: 'conv-123', isPinned: false });
      prisma.conversation.findUnique.mockResolvedValue(mockConversation);
      prisma.conversation.update.mockResolvedValue({ ...mockConversation, isPinned: true });

      const result = await service.togglePin('conv-123');

      expect(result.isPinned).toBe(true);
    });

    it('should toggle pin to false', async () => {
      const mockConversation = mockData.conversation({ id: 'conv-123', isPinned: true });
      prisma.conversation.findUnique.mockResolvedValue(mockConversation);
      prisma.conversation.update.mockResolvedValue({ ...mockConversation, isPinned: false });

      const result = await service.togglePin('conv-123');

      expect(result.isPinned).toBe(false);
    });
  });

  describe('toggleStar', () => {
    it('should toggle star status', async () => {
      const mockConversation = mockData.conversation({ id: 'conv-123', isStarred: false });
      prisma.conversation.findUnique.mockResolvedValue(mockConversation);
      prisma.conversation.update.mockResolvedValue({ ...mockConversation, isStarred: true });

      const result = await service.toggleStar('conv-123');

      expect(result.isStarred).toBe(true);
    });
  });

  describe('batchOperation', () => {
    it('should archive multiple conversations', async () => {
      prisma.conversation.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.batchOperation({
        ids: ['conv-1', 'conv-2', 'conv-3'],
        operation: 'archive',
      });

      expect(prisma.conversation.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['conv-1', 'conv-2', 'conv-3'] } },
        data: { isArchived: true },
      });
      expect(result).toEqual({ count: 3 });
    });

    it('should pin multiple conversations', async () => {
      prisma.conversation.updateMany.mockResolvedValue({ count: 2 });

      await service.batchOperation({
        ids: ['conv-1', 'conv-2'],
        operation: 'pin',
      });

      expect(prisma.conversation.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['conv-1', 'conv-2'] } },
        data: { isPinned: true },
      });
    });

    it('should delete multiple conversations', async () => {
      prisma.$transaction.mockResolvedValue([
        { count: 10 },
        { count: 2 },
      ] as any);

      const result = await service.batchOperation({
        ids: ['conv-1', 'conv-2'],
        operation: 'delete',
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result).toEqual([{ count: 10 }, { count: 2 }]);
    });
  });

  describe('search', () => {
    it('should search conversations by title', async () => {
      const mockConversations = [
        { ...mockData.conversation({ title: 'Test Conversation' }), _count: { messages: 2 } },
      ];

      prisma.conversation.findMany.mockResolvedValue(mockConversations);
      prisma.conversation.count.mockResolvedValue(1);

      const result = await service.search({ query: 'Test' });

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { title: { contains: 'Test', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
      expect(result.items).toHaveLength(1);
    });

    it('should search conversations by summary', async () => {
      prisma.conversation.findMany.mockResolvedValue([]);
      prisma.conversation.count.mockResolvedValue(0);

      await service.search({ query: 'summary keyword' });

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { summary: { contains: 'summary keyword', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });
  });

  describe('incrementTokens', () => {
    it('should increment token count', async () => {
      const mockConversation = mockData.conversation({ totalTokens: 100 });
      prisma.conversation.update.mockResolvedValue({ ...mockConversation, totalTokens: 150 });

      await service.incrementTokens('conv-123', 50);

      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-123' },
        data: { totalTokens: { increment: 50 } },
      });
    });
  });
});
