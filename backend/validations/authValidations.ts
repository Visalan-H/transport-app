import { z } from 'zod';

// Trimmed and lowercased so a submitted address always matches how it is
// stored/looked-up (services lowercase too — this just keeps the boundary
// consistent for callers that don't go through Zod, like the seed script).
const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Invalid email format'));

export const sendOtpSchema = z.object({
    email: emailSchema,
});

export const loginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
    username: z
        .string()
        .regex(/^[a-zA-Z0-9_]{3,20}$/, 'Username must be 3-20 characters (letters, numbers, underscores)'),
    email: emailSchema,
    password: z.string().min(8, 'Password must be at least 8 characters'),
    otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
});
