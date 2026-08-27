import {
    handleListAllowedEmails,
    handleAddAllowedEmail,
    handleRemoveAllowedEmail,
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
