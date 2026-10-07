// Client-side copies of the backend's form rules (backend/validations/authValidations.ts
// and adminValidations.ts). Each returns the note to show under the field, or null
// when the value is fine.

const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;
// Loose on purpose: catches typos like a missing @ or domain. The backend's
// zod check stays the authority on what counts as an address.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const usernameProblem = (value: string): string | null => {
    const name = value.trim();
    if (!name) return 'Pick a username.';
    if (name.includes('@')) return "Username can't be your email. Try something like john_doe.";
    if (!USERNAME_PATTERN.test(name)) return 'Use only letters, numbers and underscores.';
    if (name.length < 3) return 'Username needs at least 3 characters.';
    if (name.length > 20) return 'Username can be at most 20 characters.';
    return null;
};

export const emailProblem = (value: string): string | null => {
    const email = value.trim();
    // Not "your email": admins use this rule for students' and drivers' addresses.
    if (!email) return 'Enter an email address.';
    if (!EMAIL_PATTERN.test(email)) return 'Enter a valid email address.';
    return null;
};

export const newPasswordProblem = (value: string): string | null => {
    if (!value) return 'Choose a password.';
    if (value.length < 8) return 'Password needs at least 8 characters.';
    return null;
};

export const confirmPasswordProblem = (value: string, password: string): string | null => {
    if (!value) return 'Type the password again.';
    if (value !== password) return "Passwords don't match.";
    return null;
};

export const loginPasswordProblem = (value: string): string | null => (value ? null : 'Enter your password.');

export const driverNameProblem = (value: string): string | null => {
    const name = value.trim();
    if (!name) return 'Enter a name.';
    if (name.length > 60) return 'Name can be at most 60 characters.';
    return null;
};

// Blank is allowed: the admin page generates a password when none is typed.
export const optionalPasswordProblem = (value: string): string | null => (value ? newPasswordProblem(value) : null);
