import { createContext, useContext } from 'react';

// Split from ThemeProvider for the same reason as useAuth: a file exporting both a
// component and a hook is not Fast Refresh safe.

export type Theme = 'bright' | 'dark';

export interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used within a ThemeProvider');
    return context;
}
