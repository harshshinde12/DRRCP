export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

type ApiOk<T> = { success: true; data: T };
type ApiFail = { success: false; error: { message: string; details?: unknown } };

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('drrcp.token');
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => null)) as ApiOk<T> | ApiFail | null;
  if (!res.ok || !body || body.success === false) {
    throw new Error((body as ApiFail)?.error?.message ?? `Request failed (${res.status})`);
  }
  return (body as ApiOk<T>).data;
}
