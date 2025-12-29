import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: Bun.env.EMAIL_USER,
        pass: Bun.env.EMAIL_PASS,
    },
});

export default transporter;
