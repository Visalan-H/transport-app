import type { BunRequest } from 'bun';
import { decodeBearer } from '../services/cookieService';

export const verifyDriver = (handler: Function) => {
    return async (req: BunRequest) => {
        // No try: decodeBearer returns null rather than throwing. See verifyUser.
        const driver = await decodeBearer(req);

        // A student session token verifies against the same secret, so a valid signature alone
        // is not enough — only a token minted by /driver/login carries role: 'driver'.
        if (!driver || driver.role !== 'driver') {
            return Response.json({ success: false, error: 'Not authorized' }, { status: 401 });
        }

        return handler(req);
    };
};
