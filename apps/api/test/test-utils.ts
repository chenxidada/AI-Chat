import { Test, TestingModule } from '@nestjs/testing';

/**
 * 创建 Mock Prisma Service
 */
export function createMockPrismaService(): any {
  return {
    document: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    folder: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    tag: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    documentTag: {
      create: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    conversation: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    message: {
      create: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    biLink: {
      create: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    documentTemplate: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    pdfFile: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn((callback: any) => callback(createMockPrismaService())),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };
}

/**
 * 创建测试模块
 */
export async function createTestModule(config: {
  providers: any[];
  imports?: any[];
}): Promise<TestingModule> {
  return Test.createTestingModule({
    imports: config.imports || [],
    providers: config.providers,
  }).compile();
}

/**
 * Mock 数据生成器
 */
export const mockData = {
  document: (overrides: Record<string, any> = {}): any => ({
    id: 'test-doc-id',
    title: 'Test Document',
    content: '# Test Content\n\nThis is a test document.',
    contentPlain: 'Test Content This is a test document.',
    folderId: null,
    wordCount: 7,
    isArchived: false,
    isFavorite: false,
    isPinned: false,
    sourceType: 'manual',
    sourceUrl: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  folder: (overrides: Record<string, any> = {}): any => ({
    id: 'test-folder-id',
    name: 'Test Folder',
    parentId: null,
    sortOrder: 0,
    isPinned: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  tag: (overrides: Record<string, any> = {}): any => ({
    id: 'test-tag-id',
    name: 'test-tag',
    color: '#3b82f6',
    createdAt: new Date(),
    ...overrides,
  }),

  conversation: (overrides: Record<string, any> = {}): any => ({
    id: 'test-conv-id',
    title: 'Test Conversation',
    mode: 'general',
    isArchived: false,
    isPinned: false,
    isStarred: false,
    summary: null,
    keywords: [],
    contextDocumentIds: [],
    contextFolderId: null,
    contextTagIds: [],
    modelUsed: null,
    totalTokens: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  message: (overrides: Record<string, any> = {}): any => ({
    id: 'test-msg-id',
    conversationId: 'test-conv-id',
    role: 'user',
    content: 'Hello, this is a test message.',
    citations: [],
    tokenUsage: null,
    createdAt: new Date(),
    ...overrides,
  }),

  template: (overrides: Record<string, any> = {}): any => ({
    id: 'test-template-id',
    name: 'Test Template',
    description: 'A test template',
    content: '# Template Content\n\nContent here.',
    category: 'general',
    tags: [],
    variables: [],
    usageCount: 0,
    isPublic: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
};

/**
 * 等待函数
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 断言辅助函数
 */
export function assertHasProperties(obj: any, properties: string[]) {
  properties.forEach((prop) => {
    expect(obj).toHaveProperty(prop);
  });
}
