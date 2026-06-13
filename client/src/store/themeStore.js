import { create } from 'zustand';
import { persist } from 'zustand/middleware';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export const useThemeStore = create(
  persist(
    (set) => ({
      theme: 'dark',

      toggleTheme: () =>
        set((state) => {
          const next = state.theme === 'dark' ? 'light' : 'dark';
          applyTheme(next);
          return { theme: next };
        }),

      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
    }),
    {
      name: 'elop-theme',
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      },
    }
  )
);
