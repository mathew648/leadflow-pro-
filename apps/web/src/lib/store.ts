import { create } from "zustand";
import type { AuthUser } from "./auth";

interface AuthStore {
  user: AuthUser | null;
  isHydrated: boolean;
  setAuth: (user: AuthUser) => void;
  clearAuth: () => void;
  updateUser: (partial: Partial<AuthUser>) => void;
  setHydrated: (v: boolean) => void;
}

export const useAuthStore = create<AuthStore>()((set) => ({
  user: null,
  isHydrated: false,
  setAuth: (user) => set({ user }),
  clearAuth: () => set({ user: null }),
  updateUser: (partial) =>
    set((state) => ({ user: state.user ? { ...state.user, ...partial } : null })),
  setHydrated: (isHydrated) => set({ isHydrated }),
}));

interface UIStore {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: false, // closed by default (mobile drawer); desktop shows it via lg:static
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  commandOpen: false,
  setCommandOpen: (open) => set({ commandOpen: open }),
}));
