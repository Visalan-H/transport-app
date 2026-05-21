import { z } from 'zod';

export const driverLoginSchema = z.object({
    email: z.email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
});
