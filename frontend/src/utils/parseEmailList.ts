const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ParsedEmails {
    /** Deduplicated, lowercased, look like real addresses. */
    valid: string[];
    /** Contained an "@" but didn't parse as an address -- worth showing the admin. */
    invalid: string[];
}

/**
 * Splits on any whitespace, comma and semicolon so the same textarea accepts a
 * typed list, a column pasted straight out of a spreadsheet, and space- or
 * comma-separated addresses copied from a rendered list or a document. An email
 * never contains whitespace, so splitting on it can't break a real address.
 */
const splitCandidates = (text: string): string[] =>
    text
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);

/**
 * Tokens with no "@" at all (a name, a roll number, a column header) are not
 * an attempted email and are dropped silently -- flagging every non-email
 * token in an imported sheet as "invalid" would bury the handful of addresses
 * that are actually malformed under noise from unrelated columns.
 */
export function extractEmails(candidates: string[]): ParsedEmails {
    const seen = new Set<string>();
    const invalid: string[] = [];
    for (const raw of candidates) {
        const trimmed = raw.trim();
        if (!trimmed) continue;
        const lower = trimmed.toLowerCase();
        if (EMAIL_RE.test(lower)) seen.add(lower);
        else if (trimmed.includes('@')) invalid.push(trimmed);
    }
    return { valid: [...seen], invalid };
}

export const parseEmailText = (text: string): ParsedEmails => extractEmails(splitCandidates(text));
