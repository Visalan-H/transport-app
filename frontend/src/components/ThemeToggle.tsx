import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();
    const bgClass = theme === 'bright' ? 'bg-[#282A37] text-white' : 'bg-white text-[#282A37]';

    return (
        <button
            className={`absolute top-5 right-5 w-12 h-12 flex items-center justify-center z-1000 rounded-2xl ${bgClass}`}
            onClick={toggleTheme}
        >
            {theme === 'bright' ? <Sun size={24} /> : <Moon size={24} />}
        </button>
    );
}
