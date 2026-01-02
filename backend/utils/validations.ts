import type { BusDetails } from '../../types';

export const isBus = (obj: any): obj is BusDetails => {
    return (
        obj &&
        typeof obj.id === 'number' &&
        typeof obj.lat === 'number' &&
        typeof obj.lng === 'number' &&
        typeof obj.timestamp === 'number'
    );
};

export const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return typeof email === 'string' && emailRegex.test(email);
};

export const isValidUsername = (username: string): boolean => {
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    return typeof username === 'string' && usernameRegex.test(username);
};

export const isValidPassword = (password: string): boolean => {
    return typeof password === 'string' && password.length >= 8;
};

export const isValidOtp = (otp: string): boolean => {
    return typeof otp === 'string' && /^\d{6}$/.test(otp);
};
