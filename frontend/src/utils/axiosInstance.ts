import { Capacitor, CapacitorHttp } from '@capacitor/core';
import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL ?? '';

const axiosApi = axios.create({
    baseURL: BASE,
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' },
});

interface ApiResponse<T = unknown> {
    status: number;
    data: T;
}

const nativeRequest = async <T = unknown>(
    method: 'GET' | 'POST',
    url: string,
    data?: unknown,
): Promise<ApiResponse<T>> => {
    const res = await CapacitorHttp.request({
        method,
        url: `${BASE}${url}`,
        headers: { 'Content-Type': 'application/json' },
        data,
    });
    if (res.status >= 400) throw { status: res.status, data: res.data };
    return { status: res.status, data: res.data as T };
};

export const api = {
    get: <T = unknown>(url: string): Promise<ApiResponse<T>> =>
        Capacitor.isNativePlatform()
            ? nativeRequest<T>('GET', url)
            : axiosApi.get<T>(url).then((r) => ({ status: r.status, data: r.data })),

    post: <T = unknown>(url: string, data?: unknown): Promise<ApiResponse<T>> =>
        Capacitor.isNativePlatform()
            ? nativeRequest<T>('POST', url, data)
            : axiosApi.post<T>(url, data).then((r) => ({ status: r.status, data: r.data })),
};

export default api;