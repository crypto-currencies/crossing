import { create } from "zustand";

interface Modal {
  id: string;
  component: React.ReactNode;
}

interface UIState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  sidebarHoverIntent: boolean;
  sidebarPinned: boolean;
  modals: Modal[];
  activeModal: string | null;
  searchOpen: boolean;
}

interface UIActions {
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setSidebarHoverIntent: (hoverIntent: boolean) => void;
  setSidebarPinned: (pinned: boolean) => void;
  toggleSidebarPinned: () => void;
  openModal: (modal: Modal) => void;
  closeModal: (id: string) => void;
  closeAllModals: () => void;
  openSearch: () => void;
  closeSearch: () => void;
}

type UIStore = UIState & UIActions;

export const useUIStore = create<UIStore>()((set) => ({
  sidebarOpen: false,
  sidebarCollapsed: true,
  sidebarHoverIntent: false,
  sidebarPinned: false,
  modals: [],
  activeModal: null,
  searchOpen: false,

  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  toggleSidebarCollapsed: () =>
    set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarHoverIntent: (sidebarHoverIntent) => set({ sidebarHoverIntent }),
  setSidebarPinned: (sidebarPinned) =>
    set({
      sidebarPinned,
      sidebarCollapsed: !sidebarPinned,
      sidebarHoverIntent: sidebarPinned ? true : false,
    }),
  toggleSidebarPinned: () =>
    set((s) => ({
      sidebarPinned: !s.sidebarPinned,
      sidebarCollapsed: s.sidebarPinned,
      sidebarHoverIntent: !s.sidebarPinned,
    })),

  openModal: (modal) =>
    set((s) => ({
      modals: [...s.modals, modal],
      activeModal: modal.id,
    })),

  closeModal: (id) =>
    set((s) => {
      const modals = s.modals.filter((m) => m.id !== id);
      return {
        modals,
        activeModal: modals.at(-1)?.id ?? null,
      };
    }),

  closeAllModals: () => set({ modals: [], activeModal: null }),

  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
}));
