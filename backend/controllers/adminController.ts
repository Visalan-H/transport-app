import type { BunRequest } from 'bun';
import { AllowedEmail } from '../services/allowedEmailService';
import { Driver } from '../services/driverService';
import { User } from '../services/userService';
import { decodeCookie } from '../services/cookieService';
import { validate } from '../utils/validate';
import { emailOnlySchema, createDriverSchema, resetDriverPasswordSchema } from '../validations/adminValidations';

const actingAdmin = async (req: BunRequest): Promise<string> => {
    const session = await decodeCookie(req);
    return (session?.email as string) ?? 'unknown';
};

// --- signup allowlist -------------------------------------------------------

export const handleListAllowedEmails = async () => {
    const emails = await AllowedEmail.list();
    return Response.json({ success: true, emails });
};

export const handleAddAllowedEmail = async (req: BunRequest) => {
    const result = await validate(emailOnlySchema, req);
    if (!result.ok) return result.response;

    const added = await AllowedEmail.add(result.data.email, await actingAdmin(req));

    // Already present is a no-op, not a failure — an admin re-inviting someone
    // should see success, not a confusing error.
    return Response.json({ success: true, added: Boolean(added), email: result.data.email.toLowerCase() });
};

export const handleRemoveAllowedEmail = async (req: BunRequest) => {
    const result = await validate(emailOnlySchema, req);
    if (!result.ok) return result.response;

    const removed = await AllowedEmail.remove(result.data.email);
    if (!removed) return Response.json({ success: false, error: 'Email not in the list' }, { status: 404 });

    // Note: this only blocks *future* signups. Anyone who already registered
    // keeps their account — see handleListUsers/handleRemoveUser to revoke.
    return Response.json({ success: true });
};

// --- registered students ----------------------------------------------------

export const handleListUsers = async () => {
    const users = await User.listSafe();
    return Response.json({ success: true, users });
};

export const handleRemoveUser = async (req: BunRequest) => {
    const result = await validate(emailOnlySchema, req);
    if (!result.ok) return result.response;

    const email = result.data.email.toLowerCase();

    // Removing yourself would lock you out of the page you are standing on.
    if (email === (await actingAdmin(req)).toLowerCase()) {
        return Response.json({ success: false, error: 'You cannot remove your own account' }, { status: 400 });
    }

    const removed = await User.delete(email);
    if (!removed) return Response.json({ success: false, error: 'No such user' }, { status: 404 });

    return Response.json({ success: true });
};

// --- drivers ----------------------------------------------------------------

export const handleListDrivers = async () => {
    const drivers = await Driver.listSafe();
    return Response.json({ success: true, drivers });
};

export const handleCreateDriver = async (req: BunRequest) => {
    const result = await validate(createDriverSchema, req);
    if (!result.ok) return result.response;
    const { email, username, password } = result.data;

    const passwordHash = await Bun.password.hash(password);
    const driver = await Driver.create(username, email.toLowerCase(), passwordHash);
    // create returns nothing only when the email is already registered. Asking first and inserting
    // second would let two concurrent admins both pass the check and one hit a unique violation.
    if (!driver) return Response.json({ success: false, error: 'A driver with that email exists' }, { status: 409 });

    return Response.json({
        success: true,
        driver: { id: driver.id, username: driver.username, email: driver.email },
    });
};

export const handleResetDriverPassword = async (req: BunRequest) => {
    const result = await validate(resetDriverPasswordSchema, req);
    if (!result.ok) return result.response;

    const passwordHash = await Bun.password.hash(result.data.password);
    const updated = await Driver.updatePassword(result.data.email.toLowerCase(), passwordHash);
    if (!updated) return Response.json({ success: false, error: 'No such driver' }, { status: 404 });

    // The driver app treats a rejected JWT as a signal to sign out, so an
    // in-progress session ends at its next send rather than lingering.
    return Response.json({ success: true });
};

export const handleRemoveDriver = async (req: BunRequest) => {
    const result = await validate(emailOnlySchema, req);
    if (!result.ok) return result.response;

    const removed = await Driver.delete(result.data.email.toLowerCase());
    if (!removed) return Response.json({ success: false, error: 'No such driver' }, { status: 404 });

    return Response.json({ success: true });
};
