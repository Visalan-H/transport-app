import { handleStream, handleUpdate } from '../controllers/locationController';
import { verifyUser } from '../middleware/verifyUser';
import { verifyLocationSender } from '../middleware/verifyLocationSender';

export const locationRoutes = {
    '/stream': verifyUser(handleStream),
    // Driver phones post here directly. Deliberately not rate limited: a driver sends every 5s
    // (~12/min) and many of them share one carrier NAT address, so an IP-keyed limit would cut off
    // a whole group of real buses. nginx's own limit_req zone fronts this path instead.
    '/update': { POST: verifyLocationSender(handleUpdate) },
};
