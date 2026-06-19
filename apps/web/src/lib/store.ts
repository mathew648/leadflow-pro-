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
  // Setting a user (login or after getMe) means we're authenticated AND hydrated —
  // mark hydrated so the dashboard layout renders immediately instead of re-running
  // the refresh flow (which was bouncing fresh logins back to /login).
  setAuth: (user) => set({ user, isHydrated: true }),
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
