import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Types
export type Theme = 'light' | 'dark' | 'system';
export type SidebarView = 'documents' | 'conversations' | 'search' | 'settings';

export interface UIState {
  // Theme
  theme: Theme;
  
  // Sidebar
  sidebarOpen: boolean;
  sidebarView: SidebarView;
  sidebarWidth: number;
  
  // Modals
  createDocumentModalOpen: boolean;
  createFolderModalOpen: boolean;
  settingsModalOpen: boolean;
  
  // Editor
  editorMode: 'edit' | 'preview' | 'split';
  editorFontSize: number;
  
  // Notifications
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    timestamp: number;
  }>;
  
  // Actions - Theme
  setTheme: (theme: Theme) => void;
  
  // Actions - Sidebar
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSidebarView: (view: SidebarView) => void;
  setSidebarWidth: (width: number) => void;
  
  // Actions - Modals
  openCreateDocumentModal: () => void;
  closeCreateDocumentModal: () => void;
  openCreateFolderModal: () => void;
  closeCreateFolderModal: () => void;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
  
  // Actions - Editor
  setEditorMode: (mode: 'edit' | 'preview' | 'split') => void;
  setEditorFontSize: (size: number) => void;
  
  // Actions - Notifications
  addNotification: (notification: Omit<UIState['notifications'][0], 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  
  // Reset
  reset: () => void;
}

const initialState = {
  theme: 'system' as Theme,
  sidebarOpen: true,
  sidebarView: 'documents' as SidebarView,
  sidebarWidth: 280,
  createDocumentModalOpen: false,
  createFolderModalOpen: false,
  settingsModalOpen: false,
  editorMode: 'split' as const,
  editorFontSize: 14,
  notifications: [],
};

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...initialState,

        // Theme
        setTheme: (theme) =>
          set((state) => {
            state.theme = theme;
          }),

        // Sidebar
        setSidebarOpen: (open) =>
          set((state) => {
            state.sidebarOpen = open;
          }),

        toggleSidebar: () =>
          set((state) => {
            state.sidebarOpen = !state.sidebarOpen;
          }),

        setSidebarView: (view) =>
          set((state) => {
            state.sidebarView = view;
          }),

        setSidebarWidth: (width) =>
          set((state) => {
            state.sidebarWidth = Math.max(200, Math.min(500, width));
          }),

        // Modals
        openCreateDocumentModal: () =>
          set((state) => {
            state.createDocumentModalOpen = true;
          }),

        closeCreateDocumentModal: () =>
          set((state) => {
            state.createDocumentModalOpen = false;
          }),

        openCreateFolderModal: () =>
          set((state) => {
            state.createFolderModalOpen = true;
          }),

        closeCreateFolderModal: () =>
          set((state) => {
            state.createFolderModalOpen = false;
          }),

        openSettingsModal: () =>
          set((state) => {
            state.settingsModalOpen = true;
          }),

        closeSettingsModal: () =>
          set((state) => {
            state.settingsModalOpen = false;
          }),

        // Editor
        setEditorMode: (mode) =>
          set((state) => {
            state.editorMode = mode;
          }),

        setEditorFontSize: (size) =>
          set((state) => {
            state.editorFontSize = Math.max(10, Math.min(24, size));
          }),

        // Notifications
        addNotification: (notification) =>
          set((state) => {
            state.notifications.push({
              ...notification,
              id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              timestamp: Date.now(),
            });
          }),

        removeNotification: (id) =>
          set((state) => {
            state.notifications = state.notifications.filter((n) => n.id !== id);
          }),

        clearNotifications: () =>
          set((state) => {
            state.notifications = [];
          }),

        // Reset
        reset: () => set(() => ({ ...initialState })),
      })),
      {
        name: 'ui-store',
        partialize: (state) => ({
          theme: state.theme,
          sidebarOpen: state.sidebarOpen,
          sidebarWidth: state.sidebarWidth,
          editorMode: state.editorMode,
          editorFontSize: state.editorFontSize,
        }),
      }
    ),
    { name: 'ui-store' }
  )
);
