type Cell = string | number | null | undefined;

/**
 * Build a CSV and hand it to the browser as a download. RFC 4180 quoting
 * (double a field's quotes, wrap it when it holds a comma, quote or newline)
 * so an address or name can never break a column, and a leading BOM so Excel
 * opens it as UTF-8 rather than mangling non-ASCII.
 *
 * A field that starts with = + - @ or a tab/CR is prefixed with a quote so a
 * spreadsheet treats it as text instead of a formula (CSV injection). The
 * values here are validated usernames and emails, so nothing dangerous can
 * reach this today; the guard is so that stays true if a freer column is added.
 */
export function downloadCsv(filename: string, headers: string[], rows: Cell[][]): void {
    const esc = (v: Cell): string => {
        let s = v == null ? '' : String(v);
        if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
        return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers, ...rows].map((row) => row.map(esc).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
