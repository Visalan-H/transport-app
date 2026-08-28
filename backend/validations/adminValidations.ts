import { z } from 'zod';

export const emailOnlySchema = z.object({
    email: z.email('Invalid email format'),
});

export const createDriverSchema = z.object({
    email: z.email('Invalid email format'),
    username: z.string().min(1, 'Name is required').max(60, 'Name is too long'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const resetDriverPasswordSchema = z.object({
    email: z.email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
});
