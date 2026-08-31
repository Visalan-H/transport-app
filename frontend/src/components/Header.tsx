import { useCallback, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { Sun, Moon, Menu, X, LogIn, UserPlus, LogOut, Download, Bus, Shield } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { useClickOutside } from '../hooks/useClickOutside';

export function Header() {
    const { theme, toggleTheme } = useTheme();
    const { user, logout } = useAuth();
    const { canInstall, install } = useInstallPrompt();
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const closeMobileMenu = useCallback(() => {
        setMobileMenuOpen(false);
    }, []);

    useClickOutside({ ref: menuRef, isEnabled: mobileMenuOpen, onOutsideClick: closeMobileMenu });

    const handleLogout = async () => {
        await logout();
        closeMobileMenu();
        navigate('/');
    };

    const isDriverRoute = location.pathname === '/driver';
    const isLoginRoute = location.pathname === '/login';
    const isSignupRoute = location.pathname === '/signup';
    const isAdminRoute = location.pathname === '/admin';
    const themeIcon = theme === 'bright' ? <Moon size={20} /> : <Sun size={20} />;
    const mobileThemeIcon = theme === 'bright' ? <Moon size={18} /> : <Sun size={18} />;
    const mobileThemeLabel = theme === 'bright' ? 'Dark Mode' : 'Light Mode';
    const mobileMenuIcon = mobileMenuOpen ? <X size={22} /> : <Menu size={22} />;

    return (
        <header className="flex items-center justify-between px-4 pt-3 pb-1 bg-background shrink-0">
            <h1 className="text-xl font-bold text-foreground tracking-wide">
                <Link to="/">Polaris</Link>
            </h1>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-4">
                <Link
                    to="/driver"
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm transition-colors rounded-md ${
                        isDriverRoute
                            ? 'text-foreground bg-primary/10 hover:bg-primary/20'
                            : 'text-foreground hover:text-primary'
                    }`}
                >
                    <Bus size={18} />
                    <span>Driver</span>
                </Link>
                {user?.isAdmin && (
                    <Link
                        to="/admin"
                        className={`flex items-center gap-2 px-3 py-1.5 text-sm transition-colors rounded-md ${
                            isAdminRoute
                                ? 'text-foreground bg-primary/10 hover:bg-primary/20'
                                : 'text-foreground hover:text-primary'
                        }`}
                    >
                        <Shield size={18} />
                        <span>Admin</span>
                    </Link>
                )}
                {canInstall && (
                    <button
                        onClick={install}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:text-primary transition-colors rounded-md cursor-pointer"
                    >
                        <Download size={18} />
                        <span>Install App</span>
                    </button>
                )}
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
                        <Link
                            to="/login"
                            className={`flex items-center gap-2 px-3 py-1.5 text-sm transition-colors rounded-md ${
                                isLoginRoute
                                    ? 'text-foreground bg-primary/10 hover:bg-primary/20'
                                    : 'text-foreground hover:text-primary'
                            }`}
                        >
                            <LogIn size={18} />
                            <span>Login</span>
                        </Link>
                        <Link
                            to="/signup"
                            className={`flex items-center gap-2 px-3 py-1.5 text-sm transition-colors rounded-md ${
                                isSignupRoute
                                    ? 'text-foreground bg-primary/10 hover:bg-primary/20'
                                    : 'text-foreground hover:text-primary'
                            }`}
                        >
                            <UserPlus size={18} />
                            <span>Sign Up</span>
                        </Link>
                    </>
                )}
                <button
                    onClick={toggleTheme}
                    className="p-2 text-foreground hover:text-primary transition-colors rounded-md cursor-pointer"
                    aria-label="Toggle theme"
                >
                    {themeIcon}
                </button>
            </nav>

            {/* Mobile Menu Button */}
            <div className="md:hidden relative" ref={menuRef}>
                <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="p-2 text-foreground hover:text-primary transition-colors rounded-md cursor-pointer"
                    aria-label="Open menu"
                >
                    {mobileMenuIcon}
                </button>

                {/* Mobile Dropdown Menu */}
                {mobileMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-background border border-border rounded-lg shadow-lg py-2 z-50">
                        {canInstall && (
                            <button
                                onClick={async () => {
                                    await install();
                                    closeMobileMenu();
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                            >
                                <Download size={18} />
                                <span>Install App</span>
                            </button>
                        )}

                        <button
                            onClick={toggleTheme}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                        >
                            {mobileThemeIcon}
                            <span>{mobileThemeLabel}</span>
                        </button>

                        <Link
                            to="/driver"
                            onClick={closeMobileMenu}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground transition-colors ${
                                isDriverRoute ? 'bg-muted' : 'hover:bg-muted'
                            }`}
                        >
                            <Bus size={18} />
                            <span>Driver</span>
                        </Link>

                        {user?.isAdmin && (
                            <Link
                                to="/admin"
                                onClick={closeMobileMenu}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground transition-colors ${
                                    isAdminRoute ? 'bg-muted' : 'hover:bg-muted'
                                }`}
                            >
                                <Shield size={18} />
                                <span>Admin</span>
                            </Link>
                        )}

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
                                <Link
                                    to="/login"
                                    onClick={closeMobileMenu}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground transition-colors ${
                                        isLoginRoute ? 'bg-muted' : 'hover:bg-muted'
                                    }`}
                                >
                                    <LogIn size={18} />
                                    <span>Login</span>
                                </Link>
                                <Link
                                    to="/signup"
                                    onClick={closeMobileMenu}
                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground transition-colors ${
                                        isSignupRoute ? 'bg-muted' : 'hover:bg-muted'
                                    }`}
                                >
                                    <UserPlus size={18} />
                                    <span>Sign Up</span>
                                </Link>
                            </>
                        )}
                    </div>
                )}
            </div>
        </header>
    );
}
