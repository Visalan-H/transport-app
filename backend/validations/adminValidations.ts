import { z } from 'zod';

// Trimmed and lowercased at the boundary so an admin typing mixed-case email
// (allowlist entries, driver accounts, user removal) always resolves to the
// same row the lowercased service layer stores/looks up by.
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Invalid email format'));

export const emailOnlySchema = z.object({
    email: emailSchema,
});

// Bulk invite from a pasted list or an imported spreadsheet column. Each entry
// is validated individually in the controller (not with z.array(emailSchema))
// so one bad row doesn't reject the whole batch -- the admin gets back which
// rows failed instead of a single opaque 400.
export const bulkAllowedEmailsSchema = z.object({
    emails: z.array(z.string()).min(1, 'No emails provided').max(2000, 'Too many emails at once (max 2000)'),
});

export const createDriverSchema = z.object({
    email: emailSchema,
    username: z.string().min(1, 'Name is required').max(60, 'Name is too long'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const resetDriverPasswordSchema = z.object({
    email: emailSchema,
    password: z.string().min(8, 'Password must be at least 8 characters'),
});
