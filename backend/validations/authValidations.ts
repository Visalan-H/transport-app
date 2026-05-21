import { z } from 'zod';

export const sendOtpSchema = z.object({
    email: z.email('Invalid email format'),
});

export const loginSchema = z.object({
    email: z.email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
    username: z.string().regex(/^[a-zA-Z0-9_]{3,20}$/, 'Username must be 3-20 characters (letters, numbers, underscores)'),
    email: z.email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits'),
});
