import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { adminApi, type AccessRequest, type AllowedEmail, type BulkAddResult, type Person } from '@/utils/adminApi';
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
    Send,
    X,
    UserPlus,
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
    const [requests, setRequests] = useState<AccessRequest[]>([]);
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
            const [a, r, u, d] = await Promise.all([
                adminApi.listAllowedEmails(),
                adminApi.listAccessRequests(),
                adminApi.listUsers(),
                adminApi.listDrivers(),
            ]);
            setInvites(a.data.emails ?? []);
            setRequests(r.data.requests ?? []);
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

    const tabs: { id: Tab; label: string; icon: React.ReactNode; count: number; pending?: number }[] = [
        {
            id: 'invites',
            label: 'Invites',
            icon: <MailCheck size={16} />,
            count: invites.length,
            pending: requests.length,
        },
        { id: 'students', label: 'Students', icon: <Users size={16} />, count: students.length },
        { id: 'drivers', label: 'Drivers', icon: <Bus size={16} />, count: drivers.length },
    ];

    return (
        <div className="flex-1 overflow-x-hidden overflow-y-auto px-4 py-8">
            <div className="mx-auto w-full max-w-3xl space-y-8">
                <div className="flex items-start justify-between gap-4">
                    <h1 className="text-3xl font-extrabold tracking-wide text-foreground">Admin</h1>
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
                            className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-2 text-xs font-medium transition-colors sm:gap-2 sm:px-3 sm:text-sm ${
                                tab === t.id
                                    ? 'bg-primary/10 text-foreground'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            }`}
                        >
                            {/* Icon is decoration on a phone -- three tabs with icon, label and two badges
                                do not fit in 360px, and the label is the part that carries meaning. */}
                            <span className="hidden sm:contents">{t.icon}</span>
                            <span className="truncate">{t.label}</span>
                            <span className="shrink-0 rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
                                {t.count}
                            </span>
                            {t.pending ? (
                                <span
                                    className="shrink-0 rounded-full bg-amber-400/20 px-1.5 text-xs font-semibold tabular-nums text-amber-600 dark:text-amber-400"
                                    title={`${t.pending} access request${t.pending === 1 ? '' : 's'} waiting`}
                                >
                                    +{t.pending}
                                </span>
                            ) : null}
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

                {tab === 'invites' && (
                    <InvitesTab invites={invites} requests={requests} students={students} busy={busy} run={run} />
                )}
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
    return <div className="rounded-2xl border border-border/60 bg-card/70 p-5 space-y-5 sm:p-6">{children}</div>;
}

function EmptyRow({ text }: { text: string }) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{text}</p>;
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
        <div className="rounded-2xl border border-border bg-muted/40 p-5 space-y-4 sm:p-6">
            <div className="space-y-1">
                <h2 className="font-semibold text-foreground">Password for {issued.email}</h2>
                <p className="text-sm text-muted-foreground">Copy it now — it won't be shown again.</p>
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

// --- access requests --------------------------------------------------------

function AccessRequestsCard({ requests, busy, run }: { requests: AccessRequest[]; busy: string | null; run: RunFn }) {
    return (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-400/5 p-5 space-y-4 sm:p-6">
            <div className="flex items-center gap-2">
                <UserPlus size={18} className="text-amber-600 dark:text-amber-400" />
                <h2 className="font-semibold text-foreground">
                    Access requests
                    <span className="ml-2 rounded-full bg-amber-400/20 px-1.5 text-xs tabular-nums text-amber-600 dark:text-amber-400">
                        {requests.length}
                    </span>
                </h2>
            </div>
            <ul className="divide-y divide-border/60">
                {requests.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-3.5">
                        <div className="min-w-0">
                            <p className="truncate text-sm text-foreground">{r.email}</p>
                            {formatDate(r.createdAt) && (
                                <p className="truncate text-xs text-muted-foreground">
                                    requested {formatDate(r.createdAt)}
                                </p>
                            )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <Button
                                type="button"
                                onClick={() =>
                                    void run(
                                        `approve-${r.email}`,
                                        () => adminApi.approveAccessRequest(r.email),
                                        `Approved ${r.email} — invite emailed.`,
                                    )
                                }
                                disabled={busy === `approve-${r.email}`}
                                className="h-9 rounded-xl px-3"
                            >
                                {busy === `approve-${r.email}` ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    <>
                                        <Check size={16} />
                                        <span className="ml-1 hidden sm:inline">Approve</span>
                                    </>
                                )}
                            </Button>
                            <button
                                onClick={() =>
                                    void run(
                                        `reject-${r.email}`,
                                        () => adminApi.rejectAccessRequest(r.email),
                                        `Dismissed request from ${r.email}.`,
                                    )
                                }
                                disabled={busy === `reject-${r.email}`}
                                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                                aria-label={`Reject ${r.email}`}
                                title="Dismiss request"
                            >
                                {busy === `reject-${r.email}` ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    <X size={16} />
                                )}
                            </button>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}

// --- invites ----------------------------------------------------------------

function InvitesTab({
    invites,
    requests,
    students,
    busy,
    run,
}: {
    invites: AllowedEmail[];
    requests: AccessRequest[];
    students: Person[];
    busy: string | null;
    run: RunFn;
}) {
    const [email, setEmail] = useState('');
    const [query, setQuery] = useState('');

    // Who has actually completed signup, so a row can show "joined" vs still
    // waiting. Cross-referenced client-side from the students list already loaded.
    const joinedEmails = useMemo(() => new Set(students.map((s) => s.email.toLowerCase())), [students]);

    const add = async (e: React.FormEvent) => {
        e.preventDefault();
        const ok = await run(
            'add-invite',
            () => adminApi.addAllowedEmail(email),
            `${email} can now sign up — invite emailed.`,
        );
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
        <div className="space-y-6">
            {requests.length > 0 && <AccessRequestsCard requests={requests} busy={busy} run={run} />}

            <SectionCard>
                <h2 className="font-semibold text-foreground">Invite an email</h2>
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
                    <EmptyRow text="No invites yet." />
                ) : filtered.length === 0 ? (
                    <EmptyRow text="No matches." />
                ) : (
                    <ul className="divide-y divide-border/60">
                        {filtered.map((row) => {
                            const joined = joinedEmails.has(row.email.toLowerCase());
                            return (
                                <li key={row.id} className="flex items-center justify-between gap-3 py-3.5">
                                    <div className="min-w-0">
                                        <p className="flex items-center gap-2 truncate text-sm text-foreground">
                                            <span className="truncate">{row.email}</span>
                                            {joined ? (
                                                <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                                    joined
                                                </span>
                                            ) : (
                                                <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                                                    not signed up
                                                </span>
                                            )}
                                        </p>
                                        <p className="truncate text-xs text-muted-foreground">
                                            {row.addedBy ? `added by ${row.addedBy}` : 'added'}
                                            {formatDate(row.createdAt) && ` · ${formatDate(row.createdAt)}`}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1">
                                        {!joined && (
                                            <button
                                                onClick={() =>
                                                    void run(
                                                        `invite-${row.email}`,
                                                        () => adminApi.inviteEmails([row.email]),
                                                        `Invite re-sent to ${row.email}.`,
                                                    )
                                                }
                                                disabled={busy === `invite-${row.email}`}
                                                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                                                aria-label={`Resend invite to ${row.email}`}
                                                title="Resend invite email"
                                            >
                                                {busy === `invite-${row.email}` ? (
                                                    <Loader2 className="size-4 animate-spin" />
                                                ) : (
                                                    <Send size={16} />
                                                )}
                                            </button>
                                        )}
                                        <button
                                            onClick={() =>
                                                void run(
                                                    `rm-invite-${row.email}`,
                                                    () => adminApi.removeAllowedEmail(row.email),
                                                    `${row.email} can no longer sign up.`,
                                                )
                                            }
                                            disabled={busy === `rm-invite-${row.email}`}
                                            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                                            aria-label={`Remove ${row.email}`}
                                        >
                                            {busy === `rm-invite-${row.email}` ? (
                                                <Loader2 className="size-4 animate-spin" />
                                            ) : (
                                                <Trash2 size={16} />
                                            )}
                                        </button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </SectionCard>
        </div>
    );
}

function BulkInviteCard({ busy, run }: { busy: string | null; run: RunFn }) {
    const [text, setText] = useState('');
    const [fileError, setFileError] = useState<string | null>(null);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<(BulkAddResult & { invited?: { sent: number; failed: number } }) | null>(null);
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
            const added = res.data.added;

            // Email the newly added students their signup link. Sent in chunks
            // so a few hundred at once ride several short requests instead of
            // one that would outlast the proxy timeout.
            let invited = { sent: 0, failed: 0 };
            for (let i = 0; i < added.length; i += 50) {
                const r = await adminApi.inviteEmails(added.slice(i, i + 50));
                invited = { sent: invited.sent + r.data.sent.length, failed: invited.failed + r.data.failed.length };
            }
            setResult({ ...res.data, invited: added.length > 0 ? invited : undefined });
        });
        if (ok) setText('');
    };

    return (
        <SectionCard>
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                    <h2 className="font-semibold text-foreground">Bulk invite</h2>
                    <p className="text-sm text-muted-foreground">Excel, CSV or paste a list.</p>
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
                placeholder="Paste emails, one per line"
                className="min-h-32 rounded-xl font-mono text-sm"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                    {parsed.valid.length === 0
                        ? ''
                        : `${parsed.valid.length} email${parsed.valid.length === 1 ? '' : 's'} ready.`}
                    {parsed.invalid.length > 0 && (
                        <span className="text-destructive">
                            {' '}
                            {parsed.invalid.length} invalid: {parsed.invalid.slice(0, 5).join(', ')}
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
                    'Invite'
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
                    {result.invited && (
                        <p className="mt-1 text-xs text-muted-foreground">
                            {result.invited.sent} emailed
                            {result.invited.failed > 0 && `, ${result.invited.failed} failed`}.
                        </p>
                    )}
                    {result.invalid.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">Rejected: {result.invalid.join(', ')}</p>
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
            <h2 className="font-semibold text-foreground">Students</h2>
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
                <EmptyRow text="No students yet." />
            ) : filtered.length === 0 ? (
                <EmptyRow text="No matches." />
            ) : (
                <ul className="divide-y divide-border/60">
                    {filtered.map((s) => {
                        const isSelf = s.email.toLowerCase() === currentEmail.toLowerCase();
                        return (
                            <li key={s.id} className="flex items-center justify-between gap-3 py-3.5">
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
        <div className="space-y-6">
            <SectionCard>
                <h2 className="font-semibold text-foreground">Add a driver</h2>
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
                                placeholder="Blank = generate"
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
                    <EmptyRow text="No matches." />
                ) : (
                    <ul className="divide-y divide-border/60">
                        {filtered.map((d) => (
                            <li key={d.id} className="flex items-center justify-between gap-3 py-3.5">
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
