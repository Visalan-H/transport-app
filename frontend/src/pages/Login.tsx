import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff, Mail, Lock } from 'lucide-react';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        const result = await login(email, password);

        if (result.ok) {
            navigate('/');
        } else {
            setError(result.message || 'Login failed');
        }

        setIsLoading(false);
    };

    return (
        <div className="flex h-[calc(100dvh-60px)] items-center justify-center bg-linear-to-b from-background to-muted/20 px-4 py-6">
            <div className="w-full max-w-md space-y-6">
                <div className="text-center space-y-1.5">
                    <h1 className="text-[42px] font-extrabold tracking-wide text-foreground leading-tight">Login</h1>
                    <p className="text-base text-muted-foreground">Sign in to never miss your bus again</p>
                </div>

                <div className="rounded-3xl border border-border/60 bg-card/70 p-7 backdrop-blur-xl">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-1.5">
                            <Label
                                htmlFor="email"
                                className="ml-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-foreground/80"
                            >
                                Email
                            </Label>
                            <div className="relative group">
                                <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70 group-focus-within:text-foreground group-focus-within:scale-110 transition-all" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoComplete="email"
                                    className="h-11 rounded-xl border-border/50 bg-background/60 pl-11 text-base transition-all focus:bg-background focus:border-foreground/25 focus:shadow-lg focus:shadow-foreground/5"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label
                                htmlFor="password"
                                className="ml-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-foreground/80"
                            >
                                Password
                            </Label>
                            <div className="relative group">
                                <Lock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70 group-focus-within:text-foreground group-focus-within:scale-110 transition-all" />
                                <Input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoComplete="current-password"
                                    className="h-11 rounded-xl border-border/50 bg-background/60 pl-11 pr-11 text-base transition-all focus:bg-background focus:border-foreground/25 focus:shadow-lg focus:shadow-foreground/5"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground hover:scale-110 transition-all"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="animate-in fade-in slide-in-from-top-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-base text-destructive">
                                <span className="flex items-center gap-2">
                                    <span className="size-1.5 rounded-full bg-destructive animate-pulse" />
                                    {error}
                                </span>
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="h-11 w-full cursor-pointer rounded-xl text-base font-semibold shadow-lg shadow-primary/10 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/20 hover:-translate-y-px active:translate-y-0 disabled:opacity-60"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <span className="flex items-center gap-2">
                                    <Loader2 className="size-5 animate-spin" />
                                    <span>Signing in…</span>
                                </span>
                            ) : (
                                'Sign in'
                            )}
                        </Button>
                    </form>
                </div>

                <p className="text-center text-base text-muted-foreground">
                    Don&apos;t have an account?{' '}
                    <Link
                        to="/signup"
                        className="font-semibold text-foreground underline-animated decoration-2 transition-all "
                    >
                        Create account
                    </Link>
                </p>
            </div>
        </div>
    );
}
