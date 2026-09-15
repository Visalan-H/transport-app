import {
    handleListAllowedEmails,
    handleAddAllowedEmail,
    handleBulkAddAllowedEmails,
    handleInviteEmails,
    handleRemoveAllowedEmail,
    handleListAccessRequests,
    handleApproveAccessRequest,
    handleRejectAccessRequest,
    handleListUsers,
    handleRemoveUser,
    handleListDrivers,
    handleCreateDriver,
    handleResetDriverPassword,
    handleRemoveDriver,
} from '../controllers/adminController';
import { verifyAdmin } from '../middleware/verifyAdmin';

/**
 * Reached as /api/admin/* in production — nginx strips the /api prefix before
 * proxying to the backend, so no new nginx location block is needed.
 */
export const adminRoutes = {
    '/admin/allowed-emails': {
        GET: verifyAdmin(handleListAllowedEmails),
        POST: verifyAdmin(handleAddAllowedEmail),
        DELETE: verifyAdmin(handleRemoveAllowedEmail),
    },
    '/admin/allowed-emails/bulk': {
        POST: verifyAdmin(handleBulkAddAllowedEmails),
    },
    '/admin/allowed-emails/invite': {
        POST: verifyAdmin(handleInviteEmails),
    },
    '/admin/access-requests': {
        GET: verifyAdmin(handleListAccessRequests),
        DELETE: verifyAdmin(handleRejectAccessRequest),
    },
    '/admin/access-requests/approve': {
        POST: verifyAdmin(handleApproveAccessRequest),
    },
    '/admin/users': {
        GET: verifyAdmin(handleListUsers),
        DELETE: verifyAdmin(handleRemoveUser),
    },
    '/admin/drivers': {
        GET: verifyAdmin(handleListDrivers),
        POST: verifyAdmin(handleCreateDriver),
        DELETE: verifyAdmin(handleRemoveDriver),
    },
    '/admin/drivers/password': {
        POST: verifyAdmin(handleResetDriverPassword),
    },
};
