import { z } from 'zod';

// Trimmed and lowercased so a driver who fat-fingers a capital letter still
// matches the lowercased row the service layer stores/looks up by.
const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Invalid email format'));

export const driverLoginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
});
