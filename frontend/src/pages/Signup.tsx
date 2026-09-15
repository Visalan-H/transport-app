import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff, Mail, Lock, User, KeyRound, ArrowLeft, Check } from 'lucide-react';

type Step = 'details' | 'verify';

export default function Signup() {
    const [searchParams] = useSearchParams();
    const [step, setStep] = useState<Step>('details');
    const [username, setUsername] = useState('');
    // Pre-filled from an invite link (?email=...) so an invited student doesn't
    // retype the address the admin already allowlisted.
    const [email, setEmail] = useState(() => searchParams.get('email')?.trim() ?? '');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Shown when the address isn't on the allowlist: instead of a dead end, the
    // student can ask the admin to add them.
    const [notAuthorized, setNotAuthorized] = useState(false);
    const [requestState, setRequestState] = useState<'idle' | 'sending' | 'sent'>('idle');

    const { sendOtp, requestAccess, register } = useAuth();
    const navigate = useNavigate();

    // Editing the address drops any prior not-authorized notice so a corrected
    // email gets a clean attempt.
    const onEmailChange = (value: string) => {
        setEmail(value);
        setNotAuthorized(false);
        setRequestState('idle');
    };

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setNotAuthorized(false);

        if (!username.trim()) {
            setError('Username is required');
            return;
        }

        setIsLoading(true);
        const result = await sendOtp(email);

        if (result.ok) {
            setStep('verify');
        } else if (/not authorized/i.test(result.message ?? '')) {
            setNotAuthorized(true);
        } else {
            setError(result.message || 'Failed to send OTP');
        }

        setIsLoading(false);
    };

    const handleRequestAccess = async () => {
        setRequestState('sending');
        await requestAccess(email);
        // Always land on "sent": the endpoint answers identically whether or not
        // the address was queued, so the UI can't imply anything about it either.
        setRequestState('sent');
    };

    const handleVerifyAndRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setIsLoading(true);
        const result = await register(username, email, password, otp);

        if (result.ok) {
            navigate('/');
        } else {
            setError(result.message || 'Registration failed');
        }

        setIsLoading(false);
    };

    return (
        <div className="flex h-[calc(100dvh-60px)] items-center justify-center bg-linear-to-b from-background to-muted/20 px-4 py-6">
            <div className="w-full max-w-md space-y-6">
                <div className="text-center space-y-1.5">
                    <h1 className="text-[42px] font-extrabold tracking-wide text-foreground leading-tight">Sign up</h1>
                    <p className="text-base text-muted-foreground">
                        {step === 'details' ? 'Create your account' : `We sent a code to ${email}`}
                    </p>
                </div>

                <div className="rounded-3xl border border-border/60 bg-card/70 p-7 backdrop-blur-xl">
                    {step === 'details' ? (
                        <form onSubmit={handleSendOtp} className="space-y-5">
                            <div className="space-y-1.5">
                                <Label
                                    htmlFor="username"
                                    className="ml-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-foreground/80"
                                >
                                    Username
                                </Label>
                                <div className="relative group">
                                    <User className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70 group-focus-within:text-foreground group-focus-within:scale-110 transition-all" />
                                    <Input
                                        id="username"
                                        type="text"
                                        placeholder="johndoe"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        required
                                        autoComplete="username"
                                        className="h-11 rounded-xl border-border/50 bg-background/60 pl-11 text-base transition-all focus:bg-background focus:border-foreground/25 focus:shadow-lg focus:shadow-foreground/5"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label
                                    htmlFor="email"
                                    className="ml-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-foreground/80"
                                >
                                    Email
                                </Label>
                                <div className="relative group">
                                    <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70 group-focus-within:text-foreground group-focus-within:scale-110 transition-all" />
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="you@example.com"
                                        value={email}
                                        onChange={(e) => onEmailChange(e.target.value)}
                                        required
                                        autoComplete="email"
                                        className="h-11 rounded-xl border-border/50 bg-background/60 pl-11 text-base transition-all focus:bg-background focus:border-foreground/25 focus:shadow-lg focus:shadow-foreground/5"
                                    />
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

                            {notAuthorized &&
                                (requestState === 'sent' ? (
                                    <div className="animate-in fade-in slide-in-from-top-2 rounded-xl border border-border/60 bg-muted/50 px-4 py-3 text-base text-foreground">
                                        <span className="flex items-center gap-2">
                                            <Check className="size-4 text-emerald-500" />
                                            Request sent. An admin will add you soon — you'll get an email when you can
                                            sign up.
                                        </span>
                                    </div>
                                ) : (
                                    <div className="animate-in fade-in slide-in-from-top-2 space-y-3 rounded-xl border border-border/60 bg-muted/40 px-4 py-3 text-base">
                                        <p className="text-muted-foreground">
                                            <span className="font-medium text-foreground">{email}</span> isn't on the
                                            transport list yet. Request access and an admin will review it.
                                        </p>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => void handleRequestAccess()}
                                            disabled={requestState === 'sending'}
                                            className="h-10 w-full rounded-xl font-semibold"
                                        >
                                            {requestState === 'sending' ? (
                                                <span className="flex items-center gap-2">
                                                    <Loader2 className="size-4 animate-spin" /> Sending…
                                                </span>
                                            ) : (
                                                'Request access'
                                            )}
                                        </Button>
                                    </div>
                                ))}

                            <Button
                                type="submit"
                                className="h-11 cursor-pointer w-full rounded-xl text-base font-semibold shadow-lg shadow-primary/10 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/20 hover:-translate-y-px active:translate-y-0 disabled:opacity-60"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <span className="flex items-center gap-2">
                                        <Loader2 className="size-5 animate-spin" />
                                        <span>Sending code…</span>
                                    </span>
                                ) : (
                                    'Verify Email'
                                )}
                            </Button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyAndRegister} className="space-y-5">
                            <button
                                type="button"
                                onClick={() => {
                                    setStep('details');
                                    setError(null);
                                }}
                                className="flex items-center gap-2 text-base font-semibold text-muted-foreground hover:text-foreground transition-all"
                            >
                                <ArrowLeft className="size-4" />
                                Back
                            </button>

                            <div className="space-y-1.5">
                                <Label
                                    htmlFor="otp"
                                    className="ml-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-foreground/80"
                                >
                                    Verification Code
                                </Label>
                                <div className="relative group">
                                    <KeyRound className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70 group-focus-within:text-foreground group-focus-within:scale-110 transition-all" />
                                    <Input
                                        id="otp"
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        maxLength={6}
                                        placeholder="123456"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                        required
                                        autoComplete="one-time-code"
                                        className="h-11 rounded-xl border-border/50 bg-background/60 pl-11 font-mono tracking-[0.3em] text-base transition-all focus:bg-background focus:border-foreground/25 focus:shadow-lg focus:shadow-foreground/5"
                                    />
                                </div>
                                <p className="text-sm text-muted-foreground ml-1">
                                    Didn't receive the code?{' '}
                                    <button
                                        type="button"
                                        onClick={() => sendOtp(email)}
                                        className="font-semibold text-foreground underline-offset-4 hover:underline"
                                    >
                                        Resend
                                    </button>
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <Label
                                    htmlFor="password"
                                    className="ml-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-foreground/80"
                                >
                                    Password
                                </Label>
                                <div className="relative group">
                                    <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70 group-focus-within:text-foreground group-focus-within:scale-110 transition-all" />
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        autoComplete="new-password"
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

                            <div className="space-y-1.5">
                                <Label
                                    htmlFor="confirmPassword"
                                    className="ml-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-foreground/80"
                                >
                                    Confirm Password
                                </Label>
                                <div className="relative group">
                                    <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70 group-focus-within:text-foreground group-focus-within:scale-110 transition-all" />
                                    <Input
                                        id="confirmPassword"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        autoComplete="new-password"
                                        className="h-11 rounded-xl border-border/50 bg-background/60 pl-11 text-base transition-all focus:bg-background focus:border-foreground/25 focus:shadow-lg focus:shadow-foreground/5"
                                    />
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
                                className="h-11 w-full rounded-xl text-base font-semibold shadow-lg shadow-primary/10 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/20 hover:-translate-y-px active:translate-y-0 disabled:opacity-60"
                                disabled={isLoading || otp.length < 6}
                            >
                                {isLoading ? (
                                    <span className="flex items-center gap-2">
                                        <Loader2 className="size-5 animate-spin" />
                                        <span>Creating account…</span>
                                    </span>
                                ) : (
                                    'Create Account'
                                )}
                            </Button>
                        </form>
                    )}
                </div>

                <p className="text-center text-base text-muted-foreground">
                    Already have an account?{' '}
                    <Link
                        to="/login"
                        className="font-semibold text-foreground decoration-2 underline-animated transition-all"
                    >
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}
