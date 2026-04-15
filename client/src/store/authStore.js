import { create } from 'zustand';

const TOKEN_KEY = 'chess_token';

export const useAuthStore = create((set) => ({
  token:           localStorage.getItem(TOKEN_KEY),
  user:            null,
  isAuthenticated: !!localStorage.getItem(TOKEN_KEY),

  setToken: (token) => {
    localStorage.setItem(TOKEN_KEY, token);
    set({ token, isAuthenticated: true });
  },
  setUser:  (user)  => set({ user }),
  logout:   ()      => {
    localStorage.removeItem(TOKEN_KEY);
    set({ token: null, user: null, isAuthenticated: false });
  },
}));
