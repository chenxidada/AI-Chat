import { create } from 'zustand';

interface ConversationState {
  // 当前对话
  currentConversationId: string | null;
  currentMode: 'general' | 'knowledge_base';

  // 上下文
  context: {
    documentIds: string[];
    folderId: string | null;
    tagIds: string[];
  };

  // UI 状态
  isLoading: boolean;

  // Actions
  setCurrentConversation: (id: string | null) => void;
  setMode: (mode: 'general' | 'knowledge_base') => void;
  setContext: (context: Partial<ConversationState['context']>) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useConversationStore = create<ConversationState>((set) => ({
  currentConversationId: null,
  currentMode: 'general',
  context: {
    documentIds: [],
    folderId: null,
    tagIds: [],
  },
  isLoading: false,

  setCurrentConversation: (id) => set({ currentConversationId: id }),
  setMode: (mode) => set({ currentMode: mode }),
  setContext: (ctx) =>
    set((state) => ({
      context: { ...state.context, ...ctx },
    })),
  setLoading: (loading) => set({ isLoading: loading }),
  reset: () =>
    set({
      currentConversationId: null,
      currentMode: 'general',
      context: {
        documentIds: [],
        folderId: null,
        tagIds: [],
      },
      isLoading: false,
    }),
}));
