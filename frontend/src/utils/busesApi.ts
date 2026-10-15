import api from './axiosInstance';

export interface BusRoute {
    id: number;
    name: string;
}

// Public, so it is not under /admin. Direct to the backend in dev; through nginx's /api/buses block
// in prod, which strips the prefix the same way /api/admin/ does (see adminApi.ts).
const BUSES_URL = import.meta.env.VITE_API_URL ? '/buses' : '/api/buses';

/** Every bus, sorted by name. Changes go through adminApi. */
export const fetchBuses = () => api.get<{ buses: BusRoute[] }>(BUSES_URL);
