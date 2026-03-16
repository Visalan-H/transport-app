import { User } from '../services/userService';
import { Otp } from '../services/otpService';
import { sendOtpEmail } from '../utils/sendOtp';
import { generateAndSetCookie, clearCookie, decodeCookie } from '../services/cookieService';
import { isEmailAllowed } from '../config/validEmails';
import { randomInt } from 'crypto';
import type { BunRequest } from 'bun';
import { isValidEmail, isValidPassword, isValidUsername, isValidOtp } from '../utils/validations';

export const handleSendOtp = async (req: BunRequest) => {
    const { email } = (await req.json()) as { email: string };

    if (!email || !isValidEmail(email)) {
        return Response.json({ success: false, error: 'Invalid email format' });
    }

    if (!isEmailAllowed(email)) {
        return Response.json({ success: false, error: 'Email not authorized' }, { status: 403 });
    }

    const otp = randomInt(100000, 999999).toString();
    const otpHash = await Bun.password.hash(otp);

    await Otp.create(email, otpHash);

    try {
        await sendOtpEmail(email, otp);
        return Response.json({ success: true });
    } catch (error) {
        // console.log(error);
        return Response.json({ success: false, error: 'Failed to send email' }, { status: 500 });
    }
};

export const handleRegister = async (req: BunRequest) => {
    const { username, email, password, otp } = (await req.json()) as {
        username: string;
        email: string;
        password: string;
        otp: string;
    };

    if (!username || !isValidUsername(username)) {
        return Response.json(
            { error: 'Username must be 3-20 characters (letters, numbers, underscores)' },
            { status: 400 },
        );
    }

    if (!email || !isValidEmail(email)) {
        return Response.json({ error: 'Invalid email format' }, { status: 400 });
    }

    if (!password || !isValidPassword(password)) {
        return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    if (!otp || !isValidOtp(otp)) {
        return Response.json({ error: 'OTP must be 6 digits' }, { status: 400 });
    }

    const otpRecord = await Otp.findByEmail(email);
    if (!otpRecord) return Response.json({ error: 'Send OTP first' }, { status: 400 });

    const otpMatched = await Bun.password.verify(otp, otpRecord.otpHash);
    if (!otpMatched) return Response.json({ error: 'Invalid OTP' }, { status: 401 });

    await Otp.delete(email);

    const existing = await User.findByEmail(email);
    if (existing) return Response.json({ error: 'Email already exists' }, { status: 400 });

    const passwordHash = await Bun.password.hash(password);
    const user = await User.create(username, email, passwordHash);
    if (!user) return Response.json({ error: 'Registration failed' }, { status: 500 });

    await generateAndSetCookie(req, user.id, user.email, user.username);

    return Response.json({ success: true, user: { id: user.id, username: user.username, email: user.email } });
};

export const handleLogin = async (req: BunRequest) => {
    const { email, password } = (await req.json()) as { email: string; password: string };

    if (!email || !isValidEmail(email)) {
        return Response.json({ error: 'Invalid email format' }, { status: 400 });
    }

    if (!password || password.length === 0) {
        return Response.json({ error: 'Password is required' }, { status: 400 });
    }

    const user = await User.findByEmail(email);
    if (!user) return Response.json({ error: 'Invalid credentials' }, { status: 401 });

    const isValidPassword = await Bun.password.verify(password, user.passwordHash);
    if (!isValidPassword) return Response.json({ error: 'Invalid credentials' }, { status: 401 });

    await generateAndSetCookie(req, user.id, user.email, user.username);

    return Response.json({ success: true, user: { id: user.id, username: user.username, email: user.email } });
};

export const handleGetMe = async (req: BunRequest) => {
    const user = await decodeCookie(req);
    if (!user) return Response.json({ authenticated: false }, { status: 401 });

    return Response.json({ authenticated: true, user });
};

export const handleLogout = async (req: BunRequest) => {
    clearCookie(req);
    return Response.json({ success: true });
};
