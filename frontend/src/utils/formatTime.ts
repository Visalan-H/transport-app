/**
 * Compact "time since" for a bus's last fix, e.g. "just now", "12s ago",
 * "3m ago", "1h ago". Deliberately coarse: past an hour the exact age of a
 * fix stops mattering to a student, who only needs to know it is old.
 */
export function formatAgo(ms: number): string {
    const sec = Math.max(0, Math.round(ms / 1000));
    if (sec < 5) return 'just now';
    if (sec < 60) return `${sec}s ago`;
    const min = Math.round(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.round(hr / 24)}d ago`;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Short absolute date for admin rows ("added on"), from an ISO string the API
 * returns. Falsy or unparseable input yields '' so a missing timestamp simply
 * shows nothing rather than "Invalid Date".
 */
export function formatDate(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : dateFormatter.format(d);
}
