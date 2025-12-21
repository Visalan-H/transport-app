import './ThemeToggle.css';

interface ThemeToggleProps {
    selectedStyle: 'bright' | 'dark';
    onToggle: (style: 'bright' | 'dark') => void;
}

export function ThemeToggle({ selectedStyle, onToggle }: ThemeToggleProps) {
    return (
        <button
            className="theme-toggle-button"
            onClick={() => onToggle(selectedStyle === 'bright' ? 'dark' : 'bright')}
        >
            {selectedStyle === 'bright' ? '☀️' : '🌙'}
        </button>
    );
}
