import nodemailer from 'nodemailer';
import { env } from './env';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: env.EMAIL_USER,
        pass: env.EMAIL_PASS,
    },
});

/**
 * Sender for every outbound mail. The display name matters for deliverability:
 * a bare gmail address whose body is branded "Polaris" reads as a mismatch to
 * spam filters, and Gmail-to-Gmail scoring is mostly content signals since
 * SPF/DKIM are Google's own.
 */
export const MAIL_FROM = { name: 'Polaris', address: env.EMAIL_USER };

export default transporter;
