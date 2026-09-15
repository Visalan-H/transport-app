import { z } from 'zod';

// Trimmed and lowercased so a submitted address always matches how it is
// stored/looked-up (services lowercase too — this just keeps the boundary
// consistent for callers that don't go through Zod, like the seed script).
const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Invalid email format'));

export const sendOtpSchema = z.object({
    email: emailSchema,
});

export const requestAccessSchema = z.object({
    email: emailSchema,
});

export const loginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
});

const usernameSchema = z
    .string()
    .regex(/^[a-zA-Z0-9_]{3,20}$/, 'Username must be 3-20 characters (letters, numbers, underscores)');
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');

// Two ways to prove an address: the OTP we emailed to it, or the invite token
// an admin's invite email carried. With a token the email comes from the token,
// so the body does not need one.
export const registerSchema = z.discriminatedUnion('method', [
    z.object({
        method: z.literal('otp'),
        username: usernameSchema,
        email: emailSchema,
        password: passwordSchema,
        otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
    }),
    z.object({
        method: z.literal('invite'),
        username: usernameSchema,
        password: passwordSchema,
        inviteToken: z.string().min(1, 'Invite token is required'),
    }),
]);
