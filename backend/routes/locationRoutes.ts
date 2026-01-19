import { handleStream, handleUpdate } from '../controllers/locationController';
import { verifyUser } from '../middleware/verifyUser';

export const locationRoutes = {
    '/stream': verifyUser(handleStream),
    '/update': { POST: handleUpdate },
};
