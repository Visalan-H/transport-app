import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL ?? '';

// Not exported: the driver page was the only consumer needing the raw client
// (for a non-JSON text/plain body), and it's gone now that the Flutter app
// replaced it. Everything else goes through the typed `api` wrapper below.
const axiosApi = axios.create({
    baseURL: BASE,
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
});

export interface ApiResponse<T = unknown> {
    status: number;
    data: T;
}

export const api = {
    get: <T = unknown>(url: string): Promise<ApiResponse<T>> =>
        axiosApi.get<T>(url).then((r) => ({ status: r.status, data: r.data })),

    post: <T = unknown>(url: string, data?: unknown): Promise<ApiResponse<T>> =>
        axiosApi.post<T>(url, data).then((r) => ({ status: r.status, data: r.data })),

    // Admin deletes identify the target by email in the body rather than the
    // URL, keeping addresses out of access logs and proxy history.
    delete: <T = unknown>(url: string, data?: unknown): Promise<ApiResponse<T>> =>
        axiosApi.delete<T>(url, { data }).then((r) => ({ status: r.status, data: r.data })),
};

export default api;
