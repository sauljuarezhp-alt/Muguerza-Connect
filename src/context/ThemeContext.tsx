import { createContext, useContext, useState, type ReactNode } from 'react';

export interface ThemeTokens {
  bg: string;
  surface: string;
  surfaceAlt: string;
  surfaceHover: string;
  border: string;
  borderLight: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  inputBg: string;
  isDark: boolean;
}

const light: ThemeTokens = {
  bg:           '#F6F5F2',
  surface:      '#FFFFFF',
  surfaceAlt:   '#F2F2F7',
  surfaceHover: '#FAFAF8',
  border:       '#E5E5EA',
  borderLight:  '#F0F0F2',
  text:         '#1C1C1E',
  textSecondary:'#8E8E93',
  textTertiary: '#3C3C43',
  inputBg:      '#FAFAFA',
  isDark:       false,
};

const dark: ThemeTokens = {
  bg:           '#0F0F11',
  surface:      '#1C1C1E',
  surfaceAlt:   '#2C2C2E',
  surfaceHover: '#3A3A3C',
  border:       '#38383A',
  borderLight:  '#2C2C2E',
  text:         '#F5F5F7',
  textSecondary:'#98989D',
  textTertiary: '#AEAEB2',
  inputBg:      '#1C1C1E',
  isDark:       true,
};

interface ThemeCtx {
  tokens: ThemeTokens;
  isDark: boolean;
  toggleDark: (v: boolean) => void;
}

const ThemeContext = createContext<ThemeCtx>({
  tokens: light,
  isDark: false,
  toggleDark: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return JSON.parse(localStorage.getItem('mc_prefs') || '{}').darkModeCritical ?? false;
    } catch {
      return false;
    }
  });

  function toggleDark(v: boolean) {
    setIsDark(v);
    try {
      const prefs = JSON.parse(localStorage.getItem('mc_prefs') || '{}');
      localStorage.setItem('mc_prefs', JSON.stringify({ ...prefs, darkModeCritical: v }));
    } catch {}
  }

  return (
    <ThemeContext.Provider value={{ tokens: isDark ? dark : light, isDark, toggleDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
