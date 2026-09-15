import type { BunRequest } from 'bun';
import { AllowedEmail } from '../services/allowedEmailService';
import { AccessRequest } from '../services/accessRequestService';
import { Driver } from '../services/driverService';
import { User } from '../services/userService';
import { decodeCookie } from '../services/cookieService';
import { sendInviteEmail, sendInviteEmails } from '../utils/sendInvite';
import { validate } from '../utils/validate';
import {
    emailSchema,
    emailOnlySchema,
    bulkAllowedEmailsSchema,
    createDriverSchema,
    resetDriverPasswordSchema,
} from '../validations/adminValidations';

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

    // A newly allowed address gets an invite email so being added is not a
    // silent state the student never learns about. A re-add of someone already
    // present is a no-op and sends nothing (use the invite endpoint to resend).
    // The email is best-effort: a mail failure must not fail the allowlisting,
    // which is the operation that actually matters and is already done.
    let invited = false;
    if (added) {
        try {
            await sendInviteEmail(result.data.email);
            invited = true;
        } catch {
            invited = false;
        }
    }

    // Already present is a no-op, not a failure — an admin re-inviting someone
    // should see success, not a confusing error.
    return Response.json({ success: true, added: Boolean(added), invited, email: result.data.email });
};

export const handleInviteEmails = async (req: BunRequest) => {
    const result = await validate(bulkAllowedEmailsSchema, req);
    if (!result.ok) return result.response;

    // Only send to addresses actually on the allowlist -- the invite links to
    // signup, which would just bounce off the "not authorized" gate otherwise.
    // Validated and lowercased per entry, matching the bulk-add path.
    const targets: string[] = [];
    for (const raw of result.data.emails) {
        const parsed = emailSchema.safeParse(raw.trim());
        if (parsed.success && (await AllowedEmail.has(parsed.data))) targets.push(parsed.data);
    }

    const { sent, failed } = await sendInviteEmails([...new Set(targets)]);
    return Response.json({ success: true, sent, failed });
};

export const handleBulkAddAllowedEmails = async (req: BunRequest) => {
    const result = await validate(bulkAllowedEmailsSchema, req);
    if (!result.ok) return result.response;

    // Validated per-entry rather than with z.array(emailSchema) in the schema
    // itself, so a handful of bad rows from a pasted spreadsheet column don't
    // reject the whole import -- they come back as `invalid` instead.
    const valid = new Set<string>();
    const invalid: string[] = [];
    for (const raw of result.data.emails) {
        const trimmed = raw.trim();
        if (!trimmed) continue; // blank line/cell -- not worth reporting back
        const parsed = emailSchema.safeParse(trimmed);
        if (parsed.success) valid.add(parsed.data);
        else invalid.push(trimmed);
    }

    const inserted = await AllowedEmail.addMany([...valid], await actingAdmin(req));
    const insertedEmails = new Set(inserted.map((row) => row.email));
    const alreadyPresent = [...valid].filter((email) => !insertedEmails.has(email));

    return Response.json({
        success: true,
        added: [...insertedEmails],
        alreadyPresent,
        invalid,
    });
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

    const email = result.data.email;

    // Removing yourself would lock you out of the page you are standing on.
    // actingAdmin still gets lowercased here (unlike email, already normalized
    // by the Zod schema): it comes straight from a session JWT, which may have
    // been minted before this fix shipped and so could still carry stale case.
    if (email === (await actingAdmin(req)).toLowerCase()) {
        return Response.json({ success: false, error: 'You cannot remove your own account' }, { status: 400 });
    }

    const removed = await User.delete(email);
    if (!removed) return Response.json({ success: false, error: 'No such user' }, { status: 404 });

    return Response.json({ success: true });
};

// --- access requests --------------------------------------------------------

export const handleListAccessRequests = async () => {
    const requests = await AccessRequest.list();
    return Response.json({ success: true, requests });
};

export const handleApproveAccessRequest = async (req: BunRequest) => {
    const result = await validate(emailOnlySchema, req);
    if (!result.ok) return result.response;
    const { email } = result.data;

    // Approving is exactly an allowlist add: move the address across, email the
    // invite (best-effort, as in handleAddAllowedEmail), then clear the request
    // regardless so an approved row never lingers in the queue.
    const added = await AllowedEmail.add(email, await actingAdmin(req));
    let invited = false;
    if (added) {
        try {
            await sendInviteEmail(email);
            invited = true;
        } catch {
            invited = false;
        }
    }
    await AccessRequest.remove(email);

    return Response.json({ success: true, invited });
};

export const handleRejectAccessRequest = async (req: BunRequest) => {
    const result = await validate(emailOnlySchema, req);
    if (!result.ok) return result.response;

    const removed = await AccessRequest.remove(result.data.email);
    if (!removed) return Response.json({ success: false, error: 'No such request' }, { status: 404 });

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
    const driver = await Driver.create(username, email, passwordHash);
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
    const updated = await Driver.updatePassword(result.data.email, passwordHash);
    if (!updated) return Response.json({ success: false, error: 'No such driver' }, { status: 404 });

    // This does not revoke anything already issued. verifyLocationSender only
    // checks the JWT signature and role claim and never touches the database,
    // so a token minted before the reset keeps working — for /update and for
    // /driver/me — until it hits SESSION_MAX_AGE (7 days) on its own.
    return Response.json({ success: true });
};

export const handleRemoveDriver = async (req: BunRequest) => {
    const result = await validate(emailOnlySchema, req);
    if (!result.ok) return result.response;

    const removed = await Driver.delete(result.data.email);
    if (!removed) return Response.json({ success: false, error: 'No such driver' }, { status: 404 });

    return Response.json({ success: true });
};
