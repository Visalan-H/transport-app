import { useTheme } from '../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export function Header() {
    const { theme, toggleTheme } = useTheme();

    return (
        <header className="flex items-center justify-between px-4 pt-3 pb-1 bg-background shrink-0">
            <h1 className="text-xl font-bold text-foreground tracking-wide cursor-pointer">Polaris</h1>
            <button
                onClick={toggleTheme}
                className="p-2 text-foreground hover:text-primary transition-colors rounded-md cursor-pointer"
                aria-label="Toggle theme"
            >
                {theme === 'bright' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
        </header>
    );
}
