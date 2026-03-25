import { handleStream, handleUpdate } from '../controllers/locationController';
import { verifyUser } from '../middleware/verifyUser';
import { verifyUpdateApiKey } from '../middleware/verifyUpdateApiKey';

export const locationRoutes = {
    '/stream': verifyUser(handleStream),
    '/update': { POST: verifyUpdateApiKey(handleUpdate) },
};
