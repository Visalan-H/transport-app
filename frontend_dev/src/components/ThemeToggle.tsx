interface ThemeToggleProps {
    selectedStyle: 'bright' | 'dark';
    onToggle: (style: 'bright' | 'dark') => void;
}

export function ThemeToggle({ selectedStyle, onToggle }: ThemeToggleProps) {
    return (
        <button
            onClick={() => onToggle(selectedStyle === 'bright' ? 'dark' : 'bright')}
            style={{
                position: 'absolute',
                top: 20,
                right: 20,
                width: 48,
                height: 48,
                borderRadius: 50,
                border: 'none',
                background: 'rgba(255, 255, 255, 0.9)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                cursor: 'pointer',
                fontSize: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s ease',
                zIndex: 1000,
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            }}
        >
            {selectedStyle === 'bright' ? '☀️' : '🌙'}
        </button>
    );
}
