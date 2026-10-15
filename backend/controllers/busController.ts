import { Bus } from '../services/busService';

export const handleListBuses = async () => {
    const buses = await Bus.list();
    return Response.json({ success: true, buses });
};
