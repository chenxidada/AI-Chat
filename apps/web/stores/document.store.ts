import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Types
export interface Document {
  id: string;
  title: string;
  content: string;
  contentPlain: string;
  folderId: string | null;
  wordCount: number;
  isArchived: boolean;
  isFavorite: boolean;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  tags: Array<{ id: string; name: string; color: string }>;
  folder?: { id: string; name: string } | null;
}

export interface DocumentState {
  // Data
  documents: Document[];
  currentDocument: Document | null;
  recentDocuments: Document[];
  favoriteDocuments: Document[];
  
  // Pagination
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  
  // Filters
  folderId: string | null;
  tagId: string | null;
  searchQuery: string;
  isFavorite: boolean | null;
  isPinned: boolean | null;
  isArchived: boolean;
  
  // UI State
  isLoading: boolean;
  error: string | null;
  selectedIds: string[];
  
  // Actions
  setDocuments: (documents: Document[]) => void;
  setCurrentDocument: (document: Document | null) => void;
  setRecentDocuments: (documents: Document[]) => void;
  setFavoriteDocuments: (documents: Document[]) => void;
  
  // Pagination
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setPagination: (pagination: { total: number; totalPages: number }) => void;
  
  // Filters
  setFolderId: (folderId: string | null) => void;
  setTagId: (tagId: string | null) => void;
  setSearchQuery: (query: string) => void;
  setIsFavorite: (isFavorite: boolean | null) => void;
  setIsPinned: (isPinned: boolean | null) => void;
  setIsArchived: (isArchived: boolean) => void;
  
  // UI Actions
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedIds: (ids: string[]) => void;
  toggleSelectId: (id: string) => void;
  clearSelection: () => void;
  
  // CRUD
  addDocument: (document: Document) => void;
  updateDocument: (id: string, updates: Partial<Document>) => void;
  removeDocument: (id: string) => void;
  removeDocuments: (ids: string[]) => void;
  
  // Reset
  reset: () => void;
}

const initialState = {
  documents: [],
  currentDocument: null,
  recentDocuments: [],
  favoriteDocuments: [],
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
  folderId: null,
  tagId: null,
  searchQuery: '',
  isFavorite: null,
  isPinned: null,
  isArchived: false,
  isLoading: false,
  error: null,
  selectedIds: [],
};

export const useDocumentStore = create<DocumentState>()(
  devtools(
    immer((set, get) => ({
      ...initialState,

      // Setters
      setDocuments: (documents) =>
        set((state) => {
          state.documents = documents;
        }),

      setCurrentDocument: (document) =>
        set((state) => {
          state.currentDocument = document;
        }),

      setRecentDocuments: (documents) =>
        set((state) => {
          state.recentDocuments = documents;
        }),

      setFavoriteDocuments: (documents) =>
        set((state) => {
          state.favoriteDocuments = documents;
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
      setFolderId: (folderId) =>
        set((state) => {
          state.folderId = folderId;
          state.page = 1;
        }),

      setTagId: (tagId) =>
        set((state) => {
          state.tagId = tagId;
          state.page = 1;
        }),

      setSearchQuery: (query) =>
        set((state) => {
          state.searchQuery = query;
          state.page = 1;
        }),

      setIsFavorite: (isFavorite) =>
        set((state) => {
          state.isFavorite = isFavorite;
          state.page = 1;
        }),

      setIsPinned: (isPinned) =>
        set((state) => {
          state.isPinned = isPinned;
          state.page = 1;
        }),

      setIsArchived: (isArchived) =>
        set((state) => {
          state.isArchived = isArchived;
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

      // CRUD
      addDocument: (document) =>
        set((state) => {
          state.documents.unshift(document);
          state.total += 1;
        }),

      updateDocument: (id, updates) =>
        set((state) => {
          const index = state.documents.findIndex((d) => d.id === id);
          if (index > -1) {
            state.documents[index] = { ...state.documents[index], ...updates };
          }
          if (state.currentDocument?.id === id) {
            state.currentDocument = { ...state.currentDocument, ...updates };
          }
        }),

      removeDocument: (id) =>
        set((state) => {
          state.documents = state.documents.filter((d) => d.id !== id);
          state.total -= 1;
          if (state.currentDocument?.id === id) {
            state.currentDocument = null;
          }
          state.selectedIds = state.selectedIds.filter((sid) => sid !== id);
        }),

      removeDocuments: (ids) =>
        set((state) => {
          state.documents = state.documents.filter((d) => !ids.includes(d.id));
          state.total -= ids.length;
          if (state.currentDocument && ids.includes(state.currentDocument.id)) {
            state.currentDocument = null;
          }
          state.selectedIds = [];
        }),

      // Reset
      reset: () => set(() => ({ ...initialState })),
    })),
    { name: 'document-store' }
  )
);
