import { z } from 'zod';

// Trimmed and lowercased so a submitted address always matches how it is
// stored/looked-up (services lowercase too — this just keeps the boundary
// consistent for callers that don't go through Zod, like the seed script).
const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.'));

export const sendOtpSchema = z.object({
    email: emailSchema,
});

export const requestAccessSchema = z.object({
    email: emailSchema,
});

export const loginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, 'Enter your password.'),
});

const usernameSchema = z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_]{3,20}$/, 'Username must be 3 to 20 letters, numbers or underscores.');
const passwordSchema = z.string().min(8, 'Password needs at least 8 characters.');

// Two ways to prove an address: the OTP we emailed to it, or the invite token
// an admin's invite email carried. With a token the email comes from the token,
// so the body does not need one.
export const registerSchema = z.discriminatedUnion('method', [
    z.object({
        method: z.literal('otp'),
        username: usernameSchema,
        email: emailSchema,
        password: passwordSchema,
        otp: z.string().regex(/^\d{6}$/, 'The code must be 6 digits.'),
    }),
    z.object({
        method: z.literal('invite'),
        username: usernameSchema,
        password: passwordSchema,
        inviteToken: z.string().min(1, 'Invite token is required'),
    }),
]);
