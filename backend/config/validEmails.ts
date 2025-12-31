export const validEmails: Set<string> = new Set([
    'visalanprivate@gmail.com',
    // Add more approved emails here
]);

export const isEmailAllowed = (email: string): boolean => {
    return validEmails.has(email.toLowerCase());
};
