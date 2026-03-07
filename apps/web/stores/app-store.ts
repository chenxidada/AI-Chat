'use client';

import { create } from 'zustand';

interface AppState {
  // Sidebar
  sidebarOpen: boolean;
  sidebarWidth: number;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // Active selections
  activeFolderId: string | null;
  activeTagId: string | null;
  setActiveFolderId: (id: string | null) => void;
  setActiveTagId: (id: string | null) => void;

  // View mode
  viewMode: 'list' | 'grid';
  setViewMode: (mode: 'list' | 'grid') => void;

  // Sort
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  setSortBy: (field: string) => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  sidebarWidth: 280,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  activeFolderId: null,
  activeTagId: null,
  setActiveFolderId: (id) => set({ activeFolderId: id, activeTagId: null }),
  setActiveTagId: (id) => set({ activeTagId: id, activeFolderId: null }),

  viewMode: 'list',
  setViewMode: (mode) => set({ viewMode: mode }),

  sortBy: 'updatedAt',
  sortOrder: 'desc',
  setSortBy: (field) => set({ sortBy: field }),
  setSortOrder: (order) => set({ sortOrder: order }),
}));
