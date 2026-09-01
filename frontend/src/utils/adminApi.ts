import api from './axiosInstance';

/**
 * The admin API lives at /admin/* on the backend, but how the browser reaches
 * it differs by environment:
 *
 *   dev  — VITE_API_URL points straight at the backend, so /admin/* is direct.
 *   prod — one origin fronted by nginx, which has no /admin location and could
 *          not gain one: `location /admin` would prefix-match the SPA's own
 *          /admin page and serve JSON instead of the app. So admin calls go
 *          through nginx's `location /api/admin/`, which strips that prefix
 *          (/api/admin/x -> /admin/x). Every path below therefore needs a
 *          segment after the prefix; a bare /api/admin would not match.
 */
const PREFIX = import.meta.env.VITE_API_URL ? '/admin' : '/api/admin';

export interface AllowedEmail {
    id: number;
    email: string;
    addedBy: string | null;
    createdAt: string | null;
}

export interface Person {
    id: number;
    username: string;
    email: string;
    createdAt: string | null;
}

export const adminApi = {
    listAllowedEmails: () => api.get<{ emails: AllowedEmail[] }>(`${PREFIX}/allowed-emails`),
    addAllowedEmail: (email: string) => api.post<{ added: boolean }>(`${PREFIX}/allowed-emails`, { email }),
    removeAllowedEmail: (email: string) => api.delete(`${PREFIX}/allowed-emails`, { email }),

    listUsers: () => api.get<{ users: Person[] }>(`${PREFIX}/users`),
    removeUser: (email: string) => api.delete(`${PREFIX}/users`, { email }),

    listDrivers: () => api.get<{ drivers: Person[] }>(`${PREFIX}/drivers`),
    createDriver: (email: string, username: string, password: string) =>
        api.post(`${PREFIX}/drivers`, { email, username, password }),
    resetDriverPassword: (email: string, password: string) =>
        api.post(`${PREFIX}/drivers/password`, { email, password }),
    removeDriver: (email: string) => api.delete(`${PREFIX}/drivers`, { email }),
};
