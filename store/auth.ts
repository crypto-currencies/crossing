import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, Session } from "@/types";

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** True while stores are being cleared + refetched during account switch. */
  isSwitchingAccount: boolean;
}

interface AuthActions {
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setSwitchingAccount: (switching: boolean) => void;
  signOut: () => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      session: null,
      user: null,
      isLoading: true,
      isAuthenticated: false,
      isSwitchingAccount: false,

      setSession: (session) =>
        set({
          session,
          user: session?.user ?? null,
          isAuthenticated: session !== null,
          isSwitchingAccount: false,
        }),

      setUser: (user) =>
        set((state) => ({
          user,
          // Keep session.user in sync so the persisted token always
          // carries the latest user data (e.g. onboardingCompleted).
          session: state.session
            ? { ...state.session, user: user ?? state.session.user }
            : state.session,
        })),

      setLoading: (isLoading) => set({ isLoading }),

      setSwitchingAccount: (isSwitchingAccount) => set({ isSwitchingAccount }),

      /**
       * Clears auth state only.
       * IMPORTANT: Call clearAllUserState() from "store/clear-user-state"
       * before calling this to avoid cross-account data leakage.
       */
      signOut: () =>
        set({
          session: null,
          user: null,
          isAuthenticated: false,
          isSwitchingAccount: false,
        }),
    }),
    {
      name: "crossing-auth",
      partialize: (state) => ({ session: state.session }),
      skipHydration: true,
    }
  )
);
