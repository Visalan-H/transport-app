import { useCallback, useState } from 'react';

/**
 * Decides when a field's validation note may appear. Nothing shows while a
 * student fills a field for the first time; a note appears once they leave it
 * with something wrong in it, and from then on it tracks their typing. After
 * a submit attempt every field speaks up, empty ones included.
 *
 * Forms using it set `noValidate` but keep `required` on their inputs: the
 * browser's own popups stay off, and screen readers still announce the field
 * as required.
 */
export function useFieldNotes() {
    const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
    const [submitted, setSubmitted] = useState(false);

    const touch = useCallback(
        (field: string) => setTouched((prev) => (prev.has(field) ? prev : new Set(prev).add(field))),
        [],
    );

    const note = (field: string, value: string, problem: string | null): string | null =>
        submitted || (touched.has(field) && value.trim() !== '') ? problem : null;

    /** Call on submit. Returns true when every problem is null and the form may go. */
    const check = (...problems: (string | null)[]): boolean => {
        setSubmitted(true);
        return problems.every((p) => p === null);
    };

    // For a form that swaps its fields out, like Signup moving to the code step.
    const reset = useCallback(() => {
        setTouched(new Set());
        setSubmitted(false);
    }, []);

    return { touch, note, check, reset };
}
