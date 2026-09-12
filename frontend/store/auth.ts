import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  phone: string | null;
  setAuth: (token: string, phone: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      phone: null,
      setAuth: (token, phone) => set({ token, phone }),
      logout: () => set({ token: null, phone: null }),
    }),
    { name: 'auth' }
  )
);
