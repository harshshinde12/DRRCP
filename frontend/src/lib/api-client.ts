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

/** Backend field-error map from Zod validation: { fieldName: string[] }. */
export type FieldErrors = Record<string, string[]>;

/** Typed access to backend validation details (error.details from the envelope). */
export function getFieldErrors(details: unknown): FieldErrors | null {
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    const out: FieldErrors = {};
    let found = false;
    for (const [k, v] of Object.entries(details as Record<string, unknown>)) {
      if (Array.isArray(v)) {
        const msgs = v.filter((m): m is string => typeof m === 'string');
        if (msgs.length > 0) { out[k] = msgs; found = true; }
      } else if (typeof v === 'string') {
        out[k] = [v]; found = true;
      }
    }
    return found ? out : null;
  }
  return null;
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

/**
 * GET a paginated envelope { data: T[], meta }.
 * I-01: paginated lists return the array directly in `data`; the object
 * fallback below only tolerates a single-key wrapper from older stubs.
 */
export async function getPaged<T>(path: string, params?: Record<string, unknown>): Promise<Paged<T>> {
  const res = await apiClient.get(path, { params });
  const body = res.data as { success: boolean; data: T[] | Record<string, unknown>; meta: Paged<T>['meta'] };
  const data = body.data as T[] | Record<string, T[]>;
  const items = Array.isArray(data) ? data : (Object.values(data).find(Array.isArray) as T[] | undefined) ?? [];
  return { items, meta: body.meta };
}

/**
 * I-01: raw envelope access — returns `data` exactly as the backend sent it.
 * No single-key collapsing. Use `apiGetOne`/`apiSendOne` below with an
 * explicit key for `{ key: value }` envelopes.
 */
export async function apiGet<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await apiClient.get(path, config);
  return res.data?.data as T;
}

/** I-01: raw envelope access for mutations — returns `data` verbatim. */
export async function apiSend<T>(method: 'post' | 'patch' | 'put' | 'delete', path: string, body?: unknown): Promise<T> {
  const res = await apiClient.request({ method, url: path, data: body });
  return res.data?.data as T;
}

/**
 * I-01: explicit single-key envelope access, e.g.
 * `apiGetOne<EmergencyRequest>('/requests/1', 'request')`.
 * The key is part of the call's type contract — no silent collapsing.
 */
export async function apiGetOne<T>(path: string, key: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await apiClient.get(path, config);
  const d = res.data?.data as Record<string, unknown>;
  if (!d || typeof d !== 'object' || Array.isArray(d) || !(key in d)) {
    throw new ApiError(0, `Unexpected response shape for GET ${path}: missing key "${key}"`);
  }
  return d[key] as T;
}

/** I-01: explicit single-key envelope access for mutations. */
export async function apiSendOne<T>(
  method: 'post' | 'patch' | 'put' | 'delete',
  path: string,
  key: string,
  body?: unknown,
): Promise<T> {
  const res = await apiClient.request({ method, url: path, data: body });
  const d = res.data?.data as Record<string, unknown>;
  if (!d || typeof d !== 'object' || Array.isArray(d) || !(key in d)) {
    throw new ApiError(0, `Unexpected response shape for ${method.toUpperCase()} ${path}: missing key "${key}"`);
  }
  return d[key] as T;
}
