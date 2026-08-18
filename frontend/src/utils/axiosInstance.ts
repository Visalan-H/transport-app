import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL ?? '';

const axiosApi = axios.create({
    baseURL: BASE,
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
});

export { axiosApi };

export interface ApiResponse<T = unknown> {
    status: number;
    data: T;
}

export const api = {
    get: <T = unknown>(url: string): Promise<ApiResponse<T>> =>
        axiosApi.get<T>(url).then((r) => ({ status: r.status, data: r.data })),

    post: <T = unknown>(url: string, data?: unknown): Promise<ApiResponse<T>> =>
        axiosApi.post<T>(url, data).then((r) => ({ status: r.status, data: r.data })),
};

export default api;
