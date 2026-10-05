import axios, { AxiosError, type AxiosRequestConfig } from 'axios';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

const TOKEN_KEY = 'drrcp.token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export interface ApiErrorShape { status: number; message: string; details?: unknown; }

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** Typed axios client: unwraps { success:true, data } and throws ApiError otherwise. */
export const apiClient = axios.create({ baseURL: API_URL, timeout: 20000 });

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (err: AxiosError<{ success: false; error?: { message?: string; details?: unknown } }>) => {
    const status = err.response?.status ?? 0;
    const message = err.response?.data?.error?.message ?? err.message ?? 'Request failed';
    const details = err.response?.data?.error?.details;
    if (status === 401 && !err.config?.url?.includes('/auth/')) {
      // Session died elsewhere — drop the token so guards redirect to login.
      setToken(null);
      window.dispatchEvent(new CustomEvent('drrcp:unauthorized'));
    }
    return Promise.reject(new ApiError(status, message, details));
  },
);

export interface Paged<T> { items: T[]; meta: import('./types.ts').PageMeta; }

/** GET a paginated envelope { data: [...], meta } (some endpoints wrap data in a key). */
export async function getPaged<T>(path: string, params?: Record<string, unknown>): Promise<Paged<T>> {
  const res = await apiClient.get(path, { params });
  const body = res.data as { success: boolean; data: T[] | Record<string, T[]>; meta: Paged<T>['meta'] };
  const data = body.data as T[] | Record<string, T[]>;
  const items = Array.isArray(data) ? data : Object.values(data)[0] ?? [];
  return { items, meta: body.meta };
}

export async function apiGet<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await apiClient.get(path, config);
  const d = res.data?.data;
  return (d && typeof d === 'object' && !Array.isArray(d) && Object.keys(d).length === 1 ? Object.values(d)[0] : d) as T;
}

export async function apiSend<T>(method: 'post' | 'patch' | 'put' | 'delete', path: string, body?: unknown): Promise<T> {
  const res = await apiClient.request({ method, url: path, data: body });
  const d = res.data?.data;
  if (Array.isArray(d) || d === null || d === undefined) return d as T;
  if (typeof d === 'object' && Object.keys(d).length === 1) return Object.values(d)[0] as T;
  return d as T;
}
