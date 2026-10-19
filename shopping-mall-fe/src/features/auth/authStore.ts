import { create } from "zustand";
import { persist } from "zustand/middleware";

export type UserRole = "ROLE_USER" | "ROLE_MERCHANT";

type AuthState = {
  accessToken: string | null;
  username: string | null;
  role: UserRole | null;
  isAuthenticated: boolean;

  setSession: (input: { accessToken: string; username: string; role: UserRole }) => void;
  updateAccessToken: (accessToken: string) => void;
  clearSession: () => void;
};

const emptySession = {
  accessToken: null,
  username: null,
  role: null,
  isAuthenticated: false,
} as const;

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      ...emptySession,
      setSession: ({ accessToken, username, role }) =>
        set({ accessToken, username, role, isAuthenticated: true }),
      updateAccessToken: (accessToken) => set({ accessToken, isAuthenticated: true }),
      clearSession: () => set({ ...emptySession }),
    }),
    {
      name: "nexora-auth",
      partialize: ({ accessToken, username, role, isAuthenticated }) => ({
        accessToken,
        username,
        role,
        isAuthenticated,
      }),
    },
  ),
);
