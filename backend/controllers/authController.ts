import { User } from '../services/userService';
import { Otp, isOtpExpired } from '../services/otpService';
import { sendOtpEmail } from '../utils/sendOtp';
import { generateAndSetCookie, clearCookie, decodeCookie } from '../services/cookieService';
import { AllowedEmail } from '../services/allowedEmailService';
import { isAdmin } from '../config/admins';
import { randomInt } from 'crypto';
import type { BunRequest } from 'bun';
import { validate } from '../utils/validate';
import { sendOtpSchema, loginSchema, registerSchema } from '../validations/authValidations';

export const handleSendOtp = async (req: BunRequest) => {
    const result = await validate(sendOtpSchema, req);
    if (!result.ok) return result.response;
    const { email } = result.data;

    if (!(await AllowedEmail.has(email))) {
        return Response.json({ success: false, error: 'Email not authorized' }, { status: 403 });
    }

    const otp = randomInt(100000, 999999).toString();
    const otpHash = await Bun.password.hash(otp);
    await Otp.create(email, otpHash);

    try {
        await sendOtpEmail(email, otp);
        return Response.json({ success: true });
    } catch {
        return Response.json({ success: false, error: 'Failed to send email' }, { status: 500 });
    }
};

export const handleRegister = async (req: BunRequest) => {
    const result = await validate(registerSchema, req);
    if (!result.ok) return result.response;
    const { username, email, password, otp } = result.data;

    const otpRecord = await Otp.findByEmail(email);
    if (!otpRecord) return Response.json({ success: false, error: 'Send OTP first' }, { status: 400 });

    if (isOtpExpired(otpRecord.createdAt)) {
        await Otp.delete(email);
        return Response.json({ success: false, error: 'OTP expired. Please request a new one.' }, { status: 401 });
    }

    const otpMatched = await Bun.password.verify(otp, otpRecord.otpHash);
    if (!otpMatched) return Response.json({ success: false, error: 'Invalid OTP' }, { status: 401 });

    await Otp.delete(email);

    const passwordHash = await Bun.password.hash(password);
    const user = await User.create(username, email, passwordHash);
    // create returns nothing only when the email is already registered.
    if (!user) return Response.json({ success: false, error: 'Email already exists' }, { status: 400 });

    await generateAndSetCookie(req, user.id, user.email, user.username);
    return Response.json({
        success: true,
        user: { id: user.id, username: user.username, email: user.email, isAdmin: isAdmin(user.email) },
    });
};

export const handleLogin = async (req: BunRequest) => {
    const result = await validate(loginSchema, req);
    if (!result.ok) return result.response;
    const { email, password } = result.data;

    const user = await User.findByEmail(email);
    if (!user) return Response.json({ success: false, error: 'Invalid credentials' }, { status: 401 });

    const isValid = await Bun.password.verify(password, user.passwordHash);
    if (!isValid) return Response.json({ success: false, error: 'Invalid credentials' }, { status: 401 });

    await generateAndSetCookie(req, user.id, user.email, user.username);
    return Response.json({
        success: true,
        user: { id: user.id, username: user.username, email: user.email, isAdmin: isAdmin(user.email) },
    });
};

export const handleGetMe = async (req: BunRequest) => {
    const user = await decodeCookie(req);
    if (!user) return Response.json({ success: false, authenticated: false }, { status: 401 });
    // isAdmin is derived from ADMIN_EMAILS on every call rather than baked into
    // the JWT, so granting or revoking admin takes effect immediately instead of
    // waiting for sessions to expire. The frontend uses it to decide what to
    // show; the admin routes check it again server-side regardless.
    return Response.json({
        success: true,
        authenticated: true,
        user: { ...user, isAdmin: isAdmin(user.email as string) },
    });
};

export const handleLogout = async (req: BunRequest) => {
    clearCookie(req);
    return Response.json({ success: true });
};
