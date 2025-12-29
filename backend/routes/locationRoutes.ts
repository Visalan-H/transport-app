import { handleStream, handleUpdate } from '../controllers/locationController';

export const locationRoutes = {
    '/stream': handleStream,
    '/update': { POST: handleUpdate },
};
