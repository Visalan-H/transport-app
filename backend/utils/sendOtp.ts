import transporter from '../config/nodemailer';
import { env } from '../config/env';

const OTP_EXPIRATION_MINUTES = env.OTP_EXPIRATION_MINUTES;

const otpTemplate = (otp: string) =>
    `<body style="font-family:system-ui;background:#f5f5f5;margin:0;padding:10px"><div style="max-width:400px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden"><div style="background:#282a37;padding:15px 20px;text-align:center;color:#fff"><h1 style="font-size:24px;font-weight:700;margin:0">Polaris</h1></div><div style="padding:20px;text-align:center"><p style="margin:10px 0;font-size:14px;color:#555">Your verification code:</p><div style="background:#f0f3f7;border:2px solid #282a37;border-radius:6px;padding:15px;margin:15px 0"><div style="font-size:40px;font-weight:700;letter-spacing:6px;color:#282a37;font-family:monospace">${otp}</div><div style="font-size:12px;color:#999;margin-top:8px">Expires in ${OTP_EXPIRATION_MINUTES} minute${OTP_EXPIRATION_MINUTES === 1 ? '' : 's'}</div></div><p style="font-size:12px;color:#999">If you didn't request this, ignore this email.</p></div><div style="padding:10px 20px;text-align:center;border-top:1px solid #e0e0e0;font-size:11px;color:#999">© 2025 Polaris</div></div></body>`;

export const sendOtpEmail = async (to: string, otp: string) => {
    return await transporter.sendMail({
        from: env.EMAIL_USER,
        to,
        subject: `${otp} is your verification code`,
        html: otpTemplate(otp),
    });
};
