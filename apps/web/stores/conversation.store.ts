import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Types
export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Array<{
    id: string;
    documentId: string;
    documentTitle: string;
    excerpt: string;
    similarity: number;
  }>;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  mode: 'general' | 'knowledge_base';
  isArchived: boolean;
  isPinned: boolean;
  isStarred: boolean;
  summary?: string;
  keywords: string[];
  totalTokens: number;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
  messageCount?: number;
}

export interface ConversationState {
  // Data
  conversations: Conversation[];
  currentConversation: Conversation | null;
  
  // Pagination
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  
  // Filters
  mode: 'general' | 'knowledge_base' | 'all';
  isPinned: boolean | null;
  isStarred: boolean | null;
  searchQuery: string;
  
  // UI State
  isLoading: boolean;
  error: string | null;
  selectedIds: string[];
  isStreaming: boolean;
  streamingContent: string;
  
  // Actions - Data
  setConversations: (conversations: Conversation[]) => void;
  setCurrentConversation: (conversation: Conversation | null) => void;
  
  // Actions - Pagination
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setPagination: (pagination: { total: number; totalPages: number }) => void;
  
  // Actions - Filters
  setMode: (mode: 'general' | 'knowledge_base' | 'all') => void;
  setIsPinned: (isPinned: boolean | null) => void;
  setIsStarred: (isStarred: boolean | null) => void;
  setSearchQuery: (query: string) => void;
  
  // Actions - UI
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedIds: (ids: string[]) => void;
  toggleSelectId: (id: string) => void;
  clearSelection: () => void;
  
  // Actions - Streaming
  setStreaming: (isStreaming: boolean) => void;
  setStreamingContent: (content: string) => void;
  appendStreamingContent: (content: string) => void;
  clearStreamingContent: () => void;
  
  // Actions - CRUD
  addConversation: (conversation: Conversation) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  removeConversation: (id: string) => void;
  removeConversations: (ids: string[]) => void;
  
  // Actions - Messages
  addMessage: (conversationId: string, message: Message) => void;
  updateConversationTitle: (id: string, title: string) => void;
  
  // Reset
  reset: () => void;
}

const initialState = {
  conversations: [],
  currentConversation: null,
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
  mode: 'all' as const,
  isPinned: null,
  isStarred: null,
  searchQuery: '',
  isLoading: false,
  error: null,
  selectedIds: [],
  isStreaming: false,
  streamingContent: '',
};

export const useConversationStore = create<ConversationState>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...initialState,

        // Data Setters
        setConversations: (conversations) =>
          set((state) => {
            state.conversations = conversations;
          }),

        setCurrentConversation: (conversation) =>
          set((state) => {
            state.currentConversation = conversation;
          }),

        // Pagination
        setPage: (page) =>
          set((state) => {
            state.page = page;
          }),

        setLimit: (limit) =>
          set((state) => {
            state.limit = limit;
            state.page = 1;
          }),

        setPagination: (pagination) =>
          set((state) => {
            state.total = pagination.total;
            state.totalPages = pagination.totalPages;
          }),

        // Filters
        setMode: (mode) =>
          set((state) => {
            state.mode = mode;
            state.page = 1;
          }),

        setIsPinned: (isPinned) =>
          set((state) => {
            state.isPinned = isPinned;
            state.page = 1;
          }),

        setIsStarred: (isStarred) =>
          set((state) => {
            state.isStarred = isStarred;
            state.page = 1;
          }),

        setSearchQuery: (query) =>
          set((state) => {
            state.searchQuery = query;
            state.page = 1;
          }),

        // UI Actions
        setLoading: (isLoading) =>
          set((state) => {
            state.isLoading = isLoading;
          }),

        setError: (error) =>
          set((state) => {
            state.error = error;
          }),

        setSelectedIds: (ids) =>
          set((state) => {
            state.selectedIds = ids;
          }),

        toggleSelectId: (id) =>
          set((state) => {
            const index = state.selectedIds.indexOf(id);
            if (index > -1) {
              state.selectedIds.splice(index, 1);
            } else {
              state.selectedIds.push(id);
            }
          }),

        clearSelection: () =>
          set((state) => {
            state.selectedIds = [];
          }),

        // Streaming
        setStreaming: (isStreaming) =>
          set((state) => {
            state.isStreaming = isStreaming;
          }),

        setStreamingContent: (content) =>
          set((state) => {
            state.streamingContent = content;
          }),

        appendStreamingContent: (content) =>
          set((state) => {
            state.streamingContent += content;
          }),

        clearStreamingContent: () =>
          set((state) => {
            state.streamingContent = '';
          }),

        // CRUD
        addConversation: (conversation) =>
          set((state) => {
            state.conversations.unshift(conversation);
            state.total += 1;
          }),

        updateConversation: (id, updates) =>
          set((state) => {
            const index = state.conversations.findIndex((c) => c.id === id);
            if (index > -1) {
              state.conversations[index] = { ...state.conversations[index], ...updates };
            }
            if (state.currentConversation?.id === id) {
              state.currentConversation = { ...state.currentConversation, ...updates };
            }
          }),

        removeConversation: (id) =>
          set((state) => {
            state.conversations = state.conversations.filter((c) => c.id !== id);
            state.total -= 1;
            if (state.currentConversation?.id === id) {
              state.currentConversation = null;
            }
            state.selectedIds = state.selectedIds.filter((sid) => sid !== id);
          }),

        removeConversations: (ids) =>
          set((state) => {
            state.conversations = state.conversations.filter((c) => !ids.includes(c.id));
            state.total -= ids.length;
            if (state.currentConversation && ids.includes(state.currentConversation.id)) {
              state.currentConversation = null;
            }
            state.selectedIds = [];
          }),

        // Messages
        addMessage: (conversationId, message) =>
          set((state) => {
            if (state.currentConversation?.id === conversationId) {
              if (!state.currentConversation.messages) {
                state.currentConversation.messages = [];
              }
              state.currentConversation.messages.push(message);
            }
          }),

        updateConversationTitle: (id, title) =>
          set((state) => {
            const conversation = state.conversations.find((c) => c.id === id);
            if (conversation) {
              conversation.title = title;
            }
            if (state.currentConversation?.id === id) {
              state.currentConversation.title = title;
            }
          }),

        // Reset
        reset: () => set(() => ({ ...initialState })),
      })),
      {
        name: 'conversation-store',
        partialize: (state) => ({
          mode: state.mode,
          limit: state.limit,
        }),
      }
    ),
    { name: 'conversation-store' }
  )
);
