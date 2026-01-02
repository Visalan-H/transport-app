import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, Menu, X, LogIn, UserPlus, LogOut } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export function Header() {
    const { theme, toggleTheme } = useTheme();
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMobileMenuOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = async () => {
        await logout();
        setMobileMenuOpen(false);
        navigate('/');
    };

    const handleNavigate = (path: string) => {
        setMobileMenuOpen(false);
        navigate(path);
    };

    return (
        <header className="flex items-center justify-between px-4 pt-3 pb-1 bg-background shrink-0">
            <h1
                className="text-xl font-bold text-foreground tracking-wide cursor-pointer"
                onClick={() => navigate('/')}
            >
                Polaris
            </h1>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-4">
                {user ? (
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:text-primary transition-colors rounded-md cursor-pointer"
                    >
                        <LogOut size={18} />
                        <span>Logout</span>
                    </button>
                ) : (
                    <>
                        <button
                            onClick={() => navigate('/login')}
                            className={`flex items-center gap-2 px-3 py-1.5 text-sm transition-colors rounded-md cursor-pointer ${
                                location.pathname === '/login'
                                    ? 'text-foreground bg-primary/10 hover:bg-primary/20'
                                    : 'text-foreground hover:text-primary'
                            }`}
                        >
                            <LogIn size={18} />
                            <span>Login</span>
                        </button>
                        <button
                            onClick={() => navigate('/signup')}
                            className={`flex items-center gap-2 px-3 py-1.5 text-sm transition-colors rounded-md cursor-pointer ${
                                location.pathname === '/signup'
                                    ? 'text-foreground bg-primary/10 hover:bg-primary/20'
                                    : 'text-foreground hover:text-primary'
                            }`}
                        >
                            <UserPlus size={18} />
                            <span>Sign Up</span>
                        </button>
                    </>
                )}
                <button
                    onClick={toggleTheme}
                    className="p-2 text-foreground hover:text-primary transition-colors rounded-md cursor-pointer"
                    aria-label="Toggle theme"
                >
                    {theme === 'bright' ? <Moon size={20} /> : <Sun size={20} />}
                </button>
            </nav>

            {/* Mobile Menu Button */}
            <div className="md:hidden relative" ref={menuRef}>
                <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="p-2 text-foreground hover:text-primary transition-colors rounded-md cursor-pointer"
                    aria-label="Open menu"
                >
                    {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
                </button>

                {/* Mobile Dropdown Menu */}
                {mobileMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-background border border-border rounded-lg shadow-lg py-2 z-50">
                        <button
                            onClick={toggleTheme}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                        >
                            {theme === 'bright' ? <Moon size={18} /> : <Sun size={18} />}
                            <span>{theme === 'bright' ? 'Dark Mode' : 'Light Mode'}</span>
                        </button>

                        <div className="border-t border-border my-1" />

                        {user ? (
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                            >
                                <LogOut size={18} />
                                <span>Logout</span>
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={() => handleNavigate('/login')}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground transition-colors ${
                                        location.pathname === '/login' ? 'bg-muted' : 'hover:bg-muted'
                                    }`}
                                >
                                    <LogIn size={18} />
                                    <span>Login</span>
                                </button>
                                <button
                                    onClick={() => handleNavigate('/signup')}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground transition-colors ${
                                        location.pathname === '/signup' ? 'bg-muted' : 'hover:bg-muted'
                                    }`}
                                >
                                    <UserPlus size={18} />
                                    <span>Sign Up</span>
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </header>
    );
}
