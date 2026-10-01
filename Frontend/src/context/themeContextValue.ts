import { createContext } from 'react';

// The context object lives alone in this file (type-only imports) so it keeps its identity when the dev server
// hot-reloads the provider's file; otherwise provider and hook could end up with two different context objects.

export type ThemeMode = 'light' | 'dark';

export interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
