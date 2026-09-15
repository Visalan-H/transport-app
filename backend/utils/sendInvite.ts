import transporter from '../config/nodemailer';
import { env } from '../config/env';
import { signupUrl } from './appUrl';

const inviteTemplate = (link: string) =>
    `<body style="font-family:system-ui;background:#f5f5f5;margin:0;padding:10px"><div style="max-width:400px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden"><div style="background:#282a37;padding:15px 20px;text-align:center;color:#fff"><h1 style="font-size:24px;font-weight:700;margin:0">Polaris</h1></div><div style="padding:20px;text-align:center"><p style="margin:10px 0;font-size:15px;color:#333">You've been added to Saveetha bus tracking.</p><p style="margin:10px 0 20px;font-size:14px;color:#555">Create your account to see your bus live on the map.</p><a href="${link}" style="display:inline-block;background:#282a37;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 28px;border-radius:6px">Sign up</a><p style="font-size:12px;color:#999;margin-top:18px">Or open this link:<br><span style="word-break:break-all;color:#555">${link}</span></p></div><div style="padding:10px 20px;text-align:center;border-top:1px solid #e0e0e0;font-size:11px;color:#999">© 2025 Polaris</div></div></body>`;

/** Send one "you're invited, sign up here" email. Throws on failure. */
export const sendInviteEmail = async (to: string) => {
    return transporter.sendMail({
        from: env.EMAIL_USER,
        to,
        subject: 'You can now sign up for Polaris bus tracking',
        html: inviteTemplate(signupUrl(to)),
    });
};

/**
 * Send invites to many addresses with a small concurrency cap. Gmail throttles
 * bursts, so this is deliberately not a fan-out of N parallel sends; the cap
 * keeps a large batch from tripping rate limits while still finishing quickly.
 * Never throws -- a per-address failure is collected and reported, so one bad
 * recipient doesn't abort the rest.
 */
export async function sendInviteEmails(emails: string[]): Promise<{ sent: string[]; failed: string[] }> {
    const sent: string[] = [];
    const failed: string[] = [];
    const CONCURRENCY = 4;

    const queue = [...emails];
    const worker = async () => {
        for (let email = queue.shift(); email !== undefined; email = queue.shift()) {
            try {
                await sendInviteEmail(email);
                sent.push(email);
            } catch {
                failed.push(email);
            }
        }
    };

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, emails.length) }, worker));
    return { sent, failed };
}
