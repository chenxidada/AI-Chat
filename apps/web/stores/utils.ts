import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

/**
 * 创建带中间件的 Store
 */
export const createStore = <T extends object>(
  name: string,
  initialState: T,
  createActions: (set: any, get: any) => T,
  options?: {
    persist?: boolean;
    persistKey?: string;
  }
) => {
  const storeCreator = immer<T>((set, get) => ({
    ...initialState,
    ...createActions(set, get),
  }));

  let store = create<T>()(devtools(storeCreator, { name }));

  if (options?.persist && options.persistKey) {
    store = create<T>()(
      persist(storeCreator, {
        name: options.persistKey,
      })
    );
  }

  return store;
};

/**
 * 通用分页状态
 */
export interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * 通用加载状态
 */
export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}

/**
 * 创建分页操作的辅助函数
 */
export const createPaginationActions = <T extends PaginationState>(set: any) => ({
  setPage: (page: number) =>
    set((state: T) => {
      state.page = page;
    }),
  setLimit: (limit: number) =>
    set((state: T) => {
      state.limit = limit;
      state.page = 1;
    }),
  setPagination: (pagination: Partial<PaginationState>) =>
    set((state: T) => {
      Object.assign(state, pagination);
    }),
});

/**
 * 创建加载状态操作的辅助函数
 */
export const createLoadingActions = <T extends LoadingState>(set: any) => ({
  setLoading: (isLoading: boolean) =>
    set((state: T) => {
      state.isLoading = isLoading;
    }),
  setError: (error: string | null) =>
    set((state: T) => {
      state.error = error;
    }),
  clearError: () =>
    set((state: T) => {
      state.error = null;
    }),
});
