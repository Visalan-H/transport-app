import { z } from 'zod';

// Trimmed and lowercased at the boundary so an admin typing mixed-case email
// (allowlist entries, driver accounts, user removal) always resolves to the
// same row the lowercased service layer stores/looks up by.
const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Invalid email format'));

export const emailOnlySchema = z.object({
    email: emailSchema,
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
