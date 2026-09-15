import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { adminApi, type AllowedEmail, type BulkAddResult, type Person } from '@/utils/adminApi';
import { useAuth } from '@/hooks/useAuth';
import { parseEmailText } from '@/utils/parseEmailList';
import { formatDate } from '@/utils/formatTime';
import { downloadCsv } from '@/utils/downloadCsv';
import {
    Loader2,
    Plus,
    Trash2,
    KeyRound,
    Copy,
    Check,
    MailCheck,
    Users,
    Bus,
    RefreshCw,
    Upload,
    Search,
    Download,
} from 'lucide-react';

type Tab = 'invites' | 'students' | 'drivers';

type Issued = { email: string; password: string };

const errText = (err: unknown, fallback: string): string => {
    const e = err as { data?: { error?: string }; response?: { data?: { error?: string } }; message?: string };
    return e?.response?.data?.error ?? e?.data?.error ?? e?.message ?? fallback;
};

/** Long enough that it does not need a complexity rule, short enough to read aloud. */
const generatePassword = (): string => {
    const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = crypto.getRandomValues(new Uint32Array(14));
    return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
};

export default function Admin() {
    const { user } = useAuth();
    const [tab, setTab] = useState<Tab>('invites');

    const [invites, setInvites] = useState<AllowedEmail[]>([]);
    const [students, setStudents] = useState<Person[]>([]);
    const [drivers, setDrivers] = useState<Person[]>([]);

    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    // A freshly issued driver password lives at the page level, not inside the
    // Drivers tab: the plaintext exists nowhere else, so it must not vanish the
    // moment an admin flicks to another tab before copying it.
    const [issued, setIssued] = useState<Issued | null>(null);

    const refresh = useCallback(async () => {
        setError(null);
        try {
            const [a, u, d] = await Promise.all([
                adminApi.listAllowedEmails(),
                adminApi.listUsers(),
                adminApi.listDrivers(),
            ]);
            setInvites(a.data.emails ?? []);
            setStudents(u.data.users ?? []);
            setDrivers(d.data.drivers ?? []);
        } catch (err) {
            setError(errText(err, 'Could not load admin data'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const run = async (key: string, fn: () => Promise<unknown>, successMessage?: string) => {
        setBusy(key);
        setError(null);
        setNotice(null);
        try {
            await fn();
            if (successMessage) setNotice(successMessage);
            await refresh();
            return true;
        } catch (err) {
            setError(errText(err, 'Something went wrong'));
            return false;
        } finally {
            setBusy(null);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-1 items-center justify-center">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const tabs: { id: Tab; label: string; icon: React.ReactNode; count: number }[] = [
        { id: 'invites', label: 'Invites', icon: <MailCheck size={16} />, count: invites.length },
        { id: 'students', label: 'Students', icon: <Users size={16} />, count: students.length },
        { id: 'drivers', label: 'Drivers', icon: <Bus size={16} />, count: drivers.length },
    ];

    return (
        <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="mx-auto w-full max-w-3xl space-y-6">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-extrabold tracking-wide text-foreground">Admin</h1>
                        <p className="text-sm text-muted-foreground">Manage who can sign up and who can drive.</p>
                    </div>
                    <button
                        onClick={() => void refresh()}
                        className="mt-1 shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="Refresh"
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>

                <div className="flex gap-1 rounded-xl border border-border/60 bg-card/50 p-1">
                    {tabs.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => {
                                setTab(t.id);
                                setError(null);
                                setNotice(null);
                            }}
                            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                tab === t.id
                                    ? 'bg-primary/10 text-foreground'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            }`}
                        >
                            {t.icon}
                            <span>{t.label}</span>
                            <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
                                {t.count}
                            </span>
                        </button>
                    ))}
                </div>

                {error && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        {error}
                    </div>
                )}
                {notice && (
                    <div className="rounded-xl border border-border/60 bg-muted/50 px-4 py-3 text-sm text-foreground">
                        {notice}
                    </div>
                )}

                {issued && <IssuedPasswordPanel issued={issued} onDismiss={() => setIssued(null)} />}

                {tab === 'invites' && <InvitesTab invites={invites} busy={busy} run={run} />}
                {tab === 'students' && (
                    <StudentsTab students={students} busy={busy} run={run} currentEmail={user?.email ?? ''} />
                )}
                {tab === 'drivers' && <DriversTab drivers={drivers} busy={busy} run={run} onIssued={setIssued} />}
            </div>
        </div>
    );
}

type RunFn = (key: string, fn: () => Promise<unknown>, successMessage?: string) => Promise<boolean>;

function SectionCard({ children }: { children: React.ReactNode }) {
    return <div className="rounded-2xl border border-border/60 bg-card/70 p-5 space-y-4">{children}</div>;
}

function EmptyRow({ text }: { text: string }) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{text}</p>;
}

/** Case-insensitive substring match across a row's fields, for the list search. */
const matchesQuery = (query: string, ...fields: (string | null | undefined)[]): boolean => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return fields.some((f) => f?.toLowerCase().includes(q));
};

function SearchExportBar({
    query,
    onQuery,
    placeholder,
    onExport,
    exportDisabled,
}: {
    query: string;
    onQuery: (v: string) => void;
    placeholder: string;
    onExport: () => void;
    exportDisabled: boolean;
}) {
    return (
        <div className="flex items-center gap-2">
            <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    value={query}
                    onChange={(e) => onQuery(e.target.value)}
                    placeholder={placeholder}
                    className="h-10 rounded-xl pl-9"
                />
            </div>
            <Button
                type="button"
                variant="outline"
                onClick={onExport}
                disabled={exportDisabled}
                className="h-10 shrink-0 rounded-xl px-3"
                aria-label="Export CSV"
            >
                <Download size={16} />
                <span className="ml-1.5 hidden sm:inline">Export</span>
            </Button>
        </div>
    );
}

/**
 * A driver password shown once, at the page level, after a create or reset.
 * Keeps its own "copied" flash so copying doesn't re-render the whole page.
 */
function IssuedPasswordPanel({ issued, onDismiss }: { issued: Issued; onDismiss: () => void }) {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(issued.password);
            setCopied(true);
        } catch {
            setCopied(false);
        }
    };

    return (
        <div className="rounded-2xl border border-border bg-muted/40 p-5 space-y-3">
            <div className="space-y-1">
                <h2 className="font-semibold text-foreground">Password for {issued.email}</h2>
                <p className="text-sm text-muted-foreground">
                    Copy this now — it is stored only as a hash and cannot be shown again. Reset it if it gets lost.
                </p>
            </div>
            <div className="flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded-xl border border-border/60 bg-background px-4 py-3 font-mono text-base text-foreground">
                    {issued.password}
                </code>
                <Button onClick={() => void copy()} className="h-11 shrink-0 rounded-xl px-4">
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    <span className="ml-1 hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
                </Button>
            </div>
            <button
                onClick={onDismiss}
                className="text-sm text-muted-foreground underline transition-colors hover:text-foreground"
            >
                Done
            </button>
        </div>
    );
}

// --- invites ----------------------------------------------------------------

function InvitesTab({ invites, busy, run }: { invites: AllowedEmail[]; busy: string | null; run: RunFn }) {
    const [email, setEmail] = useState('');
    const [query, setQuery] = useState('');

    const add = async (e: React.FormEvent) => {
        e.preventDefault();
        const ok = await run('add-invite', () => adminApi.addAllowedEmail(email), `${email} can now sign up.`);
        if (ok) setEmail('');
    };

    const filtered = useMemo(
        () => invites.filter((row) => matchesQuery(query, row.email, row.addedBy)),
        [invites, query],
    );

    const exportCsv = () =>
        downloadCsv(
            'allowed-emails.csv',
            ['Email', 'Added by', 'Added on'],
            invites.map((row) => [row.email, row.addedBy, formatDate(row.createdAt)]),
        );

    return (
        <div className="space-y-4">
            <SectionCard>
                <div className="space-y-1">
                    <h2 className="font-semibold text-foreground">Allow an email to sign up</h2>
                    <p className="text-sm text-muted-foreground">
                        Only addresses on this list can request a signup OTP. Adding someone here does not create an
                        account — they still sign up themselves.
                    </p>
                </div>
                <form onSubmit={add} className="flex gap-2">
                    <Input
                        type="email"
                        required
                        placeholder="student@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-11 rounded-xl"
                    />
                    <Button type="submit" disabled={busy === 'add-invite'} className="h-11 shrink-0 rounded-xl px-4">
                        {busy === 'add-invite' ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <>
                                <Plus size={16} />
                                <span className="ml-1 hidden sm:inline">Add</span>
                            </>
                        )}
                    </Button>
                </form>
            </SectionCard>

            <BulkInviteCard busy={busy} run={run} />

            <SectionCard>
                <h2 className="font-semibold text-foreground">Allowed emails</h2>
                {invites.length > 0 && (
                    <SearchExportBar
                        query={query}
                        onQuery={setQuery}
                        placeholder="Search emails…"
                        onExport={exportCsv}
                        exportDisabled={invites.length === 0}
                    />
                )}
                {invites.length === 0 ? (
                    <EmptyRow text="Nobody is allowed to sign up yet." />
                ) : filtered.length === 0 ? (
                    <EmptyRow text="No emails match your search." />
                ) : (
                    <ul className="divide-y divide-border/60">
                        {filtered.map((row) => (
                            <li key={row.id} className="flex items-center justify-between gap-3 py-2.5">
                                <div className="min-w-0">
                                    <p className="truncate text-sm text-foreground">{row.email}</p>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {row.addedBy ? `added by ${row.addedBy}` : 'added'}
                                        {formatDate(row.createdAt) && ` · ${formatDate(row.createdAt)}`}
                                    </p>
                                </div>
                                <button
                                    onClick={() =>
                                        void run(
                                            `rm-invite-${row.email}`,
                                            () => adminApi.removeAllowedEmail(row.email),
                                            `${row.email} can no longer sign up.`,
                                        )
                                    }
                                    disabled={busy === `rm-invite-${row.email}`}
                                    className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                                    aria-label={`Remove ${row.email}`}
                                >
                                    {busy === `rm-invite-${row.email}` ? (
                                        <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                        <Trash2 size={16} />
                                    )}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                <p className="text-xs text-muted-foreground">
                    Removing an address only blocks future signups. Anyone who already registered keeps their account —
                    remove them under Students.
                </p>
            </SectionCard>
        </div>
    );
}

function BulkInviteCard({ busy, run }: { busy: string | null; run: RunFn }) {
    const [text, setText] = useState('');
    const [fileError, setFileError] = useState<string | null>(null);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<BulkAddResult | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const parsed = useMemo(() => parseEmailText(text), [text]);

    const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // so picking the same file again still fires onChange
        if (!file) return;

        setFileError(null);
        setImporting(true);
        try {
            // Loaded on demand so the ZIP/spreadsheet reader is fetched only when
            // an admin actually imports a file, never as part of opening the page.
            const { readFileText } = await import('@/utils/parseSpreadsheet');
            const { valid: fromFile } = parseEmailText(await readFileText(file));
            if (fromFile.length === 0) {
                setFileError(`No emails found in ${file.name}.`);
                return;
            }
            // Append to whatever's already in the box rather than replacing it, so
            // an import never wipes lines the admin has typed -- including ones
            // still being corrected (which parsed.valid would silently drop).
            setText((prev) => {
                const kept = prev.split('\n').map((l) => l.trim());
                const existing = new Set(kept.filter(Boolean).map((l) => l.toLowerCase()));
                const additions = fromFile.filter((email) => !existing.has(email));
                return [...kept, ...additions].filter(Boolean).join('\n');
            });
            setResult(null);
        } catch {
            setFileError(`Could not read ${file.name}. Try a .csv, .xlsx or .ods file, or paste the emails instead.`);
        } finally {
            setImporting(false);
        }
    };

    const submit = async () => {
        if (parsed.valid.length === 0) return;
        setFileError(null);
        const ok = await run('bulk-invite', async () => {
            const res = await adminApi.bulkAddAllowedEmails(parsed.valid);
            setResult(res.data);
        });
        if (ok) setText('');
    };

    return (
        <SectionCard>
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                    <h2 className="font-semibold text-foreground">Bulk import</h2>
                    <p className="text-sm text-muted-foreground">
                        Upload an Excel/CSV export or paste a column of emails — any cell that isn't an address (names,
                        roll numbers, a header row) is ignored automatically.
                    </p>
                </div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.tsv,.txt,.xlsx,.ods"
                    className="hidden"
                    onChange={(e) => void onFileChange(e)}
                />
                <Button
                    type="button"
                    variant="outline"
                    disabled={importing}
                    onClick={() => fileInputRef.current?.click()}
                    className="h-9 shrink-0 rounded-xl px-3"
                >
                    {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload size={16} />}
                    <span className="ml-1.5 hidden sm:inline">{importing ? 'Reading…' : 'Upload file'}</span>
                </Button>
            </div>

            {fileError && <p className="text-sm text-destructive">{fileError}</p>}

            <Textarea
                value={text}
                onChange={(e) => {
                    setText(e.target.value);
                    setResult(null);
                }}
                placeholder={'one@example.com\ntwo@example.com\n…or paste a column copied straight out of Excel'}
                className="min-h-32 rounded-xl font-mono text-sm"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                    {parsed.valid.length === 0
                        ? 'No emails detected yet.'
                        : `${parsed.valid.length} email${parsed.valid.length === 1 ? '' : 's'} ready to invite.`}
                    {parsed.invalid.length > 0 && (
                        <span className="text-destructive">
                            {' '}
                            {parsed.invalid.length} don't look valid: {parsed.invalid.slice(0, 5).join(', ')}
                            {parsed.invalid.length > 5 ? ', …' : ''}
                        </span>
                    )}
                </p>
                {text && (
                    <button
                        type="button"
                        onClick={() => {
                            setText('');
                            setResult(null);
                        }}
                        className="text-xs text-muted-foreground underline transition-colors hover:text-foreground"
                    >
                        Clear
                    </button>
                )}
            </div>

            <Button
                type="button"
                onClick={() => void submit()}
                disabled={parsed.valid.length === 0 || busy === 'bulk-invite'}
                className="h-11 w-full rounded-xl font-semibold"
            >
                {busy === 'bulk-invite' ? (
                    <span className="flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" /> Inviting…
                    </span>
                ) : parsed.valid.length === 0 ? (
                    'Invite students'
                ) : (
                    `Invite ${parsed.valid.length} ${parsed.valid.length === 1 ? 'student' : 'students'}`
                )}
            </Button>

            {result && (
                <div className="rounded-xl border border-border/60 bg-muted/50 px-4 py-3 text-sm text-foreground">
                    <p>
                        {result.added.length} added
                        {result.alreadyPresent.length > 0 && `, ${result.alreadyPresent.length} already invited`}
                        {result.invalid.length > 0 && `, ${result.invalid.length} rejected`}.
                    </p>
                    {result.invalid.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                            Rejected by the server: {result.invalid.join(', ')}
                        </p>
                    )}
                </div>
            )}
        </SectionCard>
    );
}

// --- students ---------------------------------------------------------------

function StudentsTab({
    students,
    busy,
    run,
    currentEmail,
}: {
    students: Person[];
    busy: string | null;
    run: RunFn;
    currentEmail: string;
}) {
    const [query, setQuery] = useState('');

    const filtered = useMemo(() => students.filter((s) => matchesQuery(query, s.username, s.email)), [students, query]);

    const exportCsv = () =>
        downloadCsv(
            'students.csv',
            ['Name', 'Email', 'Signed up'],
            students.map((s) => [s.username, s.email, formatDate(s.createdAt)]),
        );

    return (
        <SectionCard>
            <div className="space-y-1">
                <h2 className="font-semibold text-foreground">Registered students</h2>
                <p className="text-sm text-muted-foreground">
                    People who completed signup. Removing someone deletes their account and signs them out.
                </p>
            </div>
            {students.length > 0 && (
                <SearchExportBar
                    query={query}
                    onQuery={setQuery}
                    placeholder="Search name or email…"
                    onExport={exportCsv}
                    exportDisabled={students.length === 0}
                />
            )}
            {students.length === 0 ? (
                <EmptyRow text="No students have signed up yet." />
            ) : filtered.length === 0 ? (
                <EmptyRow text="No students match your search." />
            ) : (
                <ul className="divide-y divide-border/60">
                    {filtered.map((s) => {
                        const isSelf = s.email.toLowerCase() === currentEmail.toLowerCase();
                        return (
                            <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                                <div className="min-w-0">
                                    <p className="truncate text-sm text-foreground">
                                        {s.username}
                                        {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {s.email}
                                        {formatDate(s.createdAt) && ` · joined ${formatDate(s.createdAt)}`}
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        if (!confirm(`Delete ${s.username}'s account (${s.email})?`)) return;
                                        void run(
                                            `rm-user-${s.email}`,
                                            () => adminApi.removeUser(s.email),
                                            `Removed ${s.email}.`,
                                        );
                                    }}
                                    disabled={isSelf || busy === `rm-user-${s.email}`}
                                    title={isSelf ? 'You cannot remove your own account' : undefined}
                                    className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-30"
                                    aria-label={`Remove ${s.email}`}
                                >
                                    {busy === `rm-user-${s.email}` ? (
                                        <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                        <Trash2 size={16} />
                                    )}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </SectionCard>
    );
}

// --- drivers ----------------------------------------------------------------

function DriversTab({
    drivers,
    busy,
    run,
    onIssued,
}: {
    drivers: Person[];
    busy: string | null;
    run: RunFn;
    onIssued: (issued: Issued) => void;
}) {
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [query, setQuery] = useState('');

    const filtered = useMemo(() => drivers.filter((d) => matchesQuery(query, d.username, d.email)), [drivers, query]);

    const exportCsv = () =>
        downloadCsv(
            'drivers.csv',
            ['Name', 'Email', 'Created'],
            drivers.map((d) => [d.username, d.email, formatDate(d.createdAt)]),
        );

    const create = async (e: React.FormEvent) => {
        e.preventDefault();
        const pw = password || generatePassword();
        const ok = await run('create-driver', () => adminApi.createDriver(email, username, pw));
        if (ok) {
            // Surface the plaintext at the page level so it survives a tab switch.
            onIssued({ email, password: pw });
            setEmail('');
            setUsername('');
            setPassword('');
        }
    };

    const reset = async (driverEmail: string) => {
        const pw = generatePassword();
        const ok = await run(`reset-${driverEmail}`, () => adminApi.resetDriverPassword(driverEmail, pw));
        if (ok) onIssued({ email: driverEmail, password: pw });
    };

    return (
        <div className="space-y-4">
            <SectionCard>
                <div className="space-y-1">
                    <h2 className="font-semibold text-foreground">Add a driver</h2>
                    <p className="text-sm text-muted-foreground">
                        Drivers do not sign up — you create the account and give them the password for the app.
                    </p>
                </div>
                <form onSubmit={create} className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="d-name" className="ml-1 text-xs font-semibold uppercase tracking-wider">
                                Name
                            </Label>
                            <Input
                                id="d-name"
                                required
                                placeholder="Route 12 driver"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="h-11 rounded-xl"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="d-email" className="ml-1 text-xs font-semibold uppercase tracking-wider">
                                Email
                            </Label>
                            <Input
                                id="d-email"
                                type="email"
                                required
                                placeholder="driver@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="h-11 rounded-xl"
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="d-pw" className="ml-1 text-xs font-semibold uppercase tracking-wider">
                            Password
                        </Label>
                        <div className="flex gap-2">
                            <Input
                                id="d-pw"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Leave blank to generate one"
                                minLength={8}
                                className="h-11 rounded-xl font-mono"
                            />
                            <Button
                                type="button"
                                onClick={() => setPassword(generatePassword())}
                                className="h-11 shrink-0 rounded-xl px-4"
                            >
                                <KeyRound size={16} />
                                <span className="ml-1 hidden sm:inline">Generate</span>
                            </Button>
                        </div>
                    </div>
                    <Button
                        type="submit"
                        disabled={busy === 'create-driver'}
                        className="h-11 w-full rounded-xl font-semibold"
                    >
                        {busy === 'create-driver' ? (
                            <span className="flex items-center gap-2">
                                <Loader2 className="size-4 animate-spin" /> Creating…
                            </span>
                        ) : (
                            'Create driver'
                        )}
                    </Button>
                </form>
            </SectionCard>

            <SectionCard>
                <h2 className="font-semibold text-foreground">Drivers</h2>
                {drivers.length > 0 && (
                    <SearchExportBar
                        query={query}
                        onQuery={setQuery}
                        placeholder="Search name or email…"
                        onExport={exportCsv}
                        exportDisabled={drivers.length === 0}
                    />
                )}
                {drivers.length === 0 ? (
                    <EmptyRow text="No drivers yet." />
                ) : filtered.length === 0 ? (
                    <EmptyRow text="No drivers match your search." />
                ) : (
                    <ul className="divide-y divide-border/60">
                        {filtered.map((d) => (
                            <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                                <div className="min-w-0">
                                    <p className="truncate text-sm text-foreground">{d.username}</p>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {d.email}
                                        {formatDate(d.createdAt) && ` · added ${formatDate(d.createdAt)}`}
                                    </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                    <button
                                        onClick={() => {
                                            if (!confirm(`Reset the password for ${d.email}? They will be signed out.`))
                                                return;
                                            void reset(d.email);
                                        }}
                                        disabled={busy === `reset-${d.email}`}
                                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                                        aria-label={`Reset password for ${d.email}`}
                                    >
                                        {busy === `reset-${d.email}` ? (
                                            <Loader2 className="size-4 animate-spin" />
                                        ) : (
                                            <KeyRound size={16} />
                                        )}
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (!confirm(`Delete driver ${d.username} (${d.email})?`)) return;
                                            void run(
                                                `rm-driver-${d.email}`,
                                                () => adminApi.removeDriver(d.email),
                                                `Removed ${d.email}.`,
                                            );
                                        }}
                                        disabled={busy === `rm-driver-${d.email}`}
                                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                                        aria-label={`Remove ${d.email}`}
                                    >
                                        {busy === `rm-driver-${d.email}` ? (
                                            <Loader2 className="size-4 animate-spin" />
                                        ) : (
                                            <Trash2 size={16} />
                                        )}
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </SectionCard>
        </div>
    );
}
