import { Children, cloneElement, createContext, forwardRef, isValidElement, useCallback, useContext, useEffect, useId, useState, type ReactNode } from 'react';
import { useMeta } from '../lib/meta.tsx';
import type { MetaGroup, PageMeta } from '../lib/types.ts';

/* ---------- Button ---------- */
type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
const BTN: Record<BtnVariant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 dark:bg-brand-600 dark:hover:bg-brand-500',
  secondary: 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800',
  danger: 'bg-red-700 text-white hover:bg-red-800',
  ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
  success: 'bg-green-700 text-white hover:bg-green-800',
};
const SIZES = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-base' };

export function Button({ variant = 'primary', size = 'md', className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: keyof typeof SIZES }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${BTN[variant]} ${SIZES[size]} ${className}`}
    />
  );
}

/* ---------- Card ---------- */
export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`card p-4 sm:p-5 ${className}`}>{children}</div>;
}

export function CardTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-base font-bold text-slate-900 dark:text-white">{children}</h2>
      {right}
    </div>
  );
}

/* ---------- Badge (meta-driven) ---------- */
export function Badge({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${className}`}>
      {children}
    </span>
  );
}

export function EnumBadge({ group, value }: { group: MetaGroup; value: string | null | undefined }) {
  const { label, badgeClass } = useMeta();
  return <Badge className={badgeClass(group, value)}>{label(group, value)}</Badge>;
}

/* ---------- Form inputs ---------- */
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(props, ref) {
  return <input {...props} ref={ref} className={`input ${props.className ?? ''}`} />;
});
export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(props, ref) {
  return <textarea {...props} ref={ref} className={`input min-h-[90px] ${props.className ?? ''}`} />;
});
export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(props, ref) {
  return <select {...props} ref={ref} className={`input ${props.className ?? ''}`} />;
});

const LABELABLE = new Set<unknown>([Input, Textarea, Select]);

export function Field({ label, error, hint, children, htmlFor }: { label: string; error?: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  // Auto-associate the label when the field wraps a single bare input/select/textarea.
  const autoId = useId();
  let control = children;
  let labelFor = htmlFor;
  if (!labelFor) {
    const kids = Children.toArray(children);
    if (kids.length === 1 && isValidElement(kids[0]) && LABELABLE.has(kids[0].type) && !(kids[0].props as { id?: string }).id) {
      labelFor = `field-${autoId}`;
      control = cloneElement(kids[0], { id: labelFor } as Record<string, unknown>);
    }
  }
  return (
    <div>
      <label htmlFor={labelFor} className="label">{label}</label>
      {control}
      {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {error && <p role="alert" className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

/* ---------- Feedback ---------- */
export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin text-brand-600 ${className}`} viewBox="0 0 24 24" fill="none" aria-label="Loading">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded bg-slate-200 dark:bg-slate-800 ${className}`} />;
}

export function CardSkeleton() {
  return (
    <Card><div className="space-y-2"><Skeleton className="h-5 w-1/3" /><Skeleton /><Skeleton className="w-2/3" /></div></Card>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 p-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-2xl dark:bg-slate-800">📭</div>
      <p className="font-semibold text-slate-900 dark:text-white">{title}</p>
      {hint && <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card flex flex-col items-center gap-2 border-red-200 p-10 text-center dark:border-red-900">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl dark:bg-red-950">⚠️</div>
      <p className="font-semibold text-red-700 dark:text-red-300">Something went wrong</p>
      <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">{message}</p>
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Retry</Button>}
    </div>
  );
}

export function StatCard({ label, value, sub, icon, accent = 'text-brand-600' }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; accent?: string }) {
  return (
    <div className="card flex items-center gap-3 p-4">
      {icon && <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xl dark:bg-slate-800 ${accent}`}>{icon}</div>}
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        <p className="truncate text-2xl font-extrabold text-slate-900 dark:text-white">{value}</p>
        {sub && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close dialog" className="absolute inset-0 bg-slate-950/60" onClick={onClose} />
      <div className={`relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl dark:bg-slate-900 sm:rounded-2xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- DataTable ---------- */
export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
}

export function DataTable<T extends { id: string }>({
  rows, columns, meta, page, onPage, emptyTitle = 'No records found', onRowClick,
}: {
  rows: T[]; columns: Column<T>[]; meta?: PageMeta | null;
  page: number; onPage: (page: number) => void; emptyTitle?: string;
  onRowClick?: (row: T) => void;
}) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const sorted = [...rows].sort((a, b) => {
    if (!sortKey) return 0;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return 0;
    const va = col.sortValue(a); const vb = col.sortValue(b);
    return (va < vb ? -1 : va > vb ? 1 : 0) * sortDir;
  });
  if (rows.length === 0) return <EmptyState title={emptyTitle} />;
  return (
    <div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
              {columns.map((c) => (
                <th key={c.key} className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {c.sortValue ? (
                    <button
                      className="inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200"
                      onClick={() => { setSortKey(c.key); setSortDir(sortKey === c.key && sortDir === 1 ? -1 : 1); }}
                      aria-label={`Sort by ${c.header}`}
                    >
                      {c.header} <span aria-hidden>{sortKey === c.key ? (sortDir === 1 ? '▲' : '▼') : '⇅'}</span>
                    </button>
                  ) : c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={row.id}
                className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60${onRowClick ? ' cursor-pointer' : ''}`}
                onClick={onRowClick ? (e) => {
                  if ((e.target as HTMLElement).closest('button,a,input,select,textarea')) return;
                  onRowClick(row);
                } : undefined}
              >
                {columns.map((c) => <td key={c.key} className="px-3 py-2.5 align-top">{c.render(row)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {meta && meta.totalPages > 1 && (
        <nav aria-label="Pagination" className="mt-3 flex items-center justify-between text-sm">
          <p className="text-slate-500 dark:text-slate-400">Page {meta.page} of {meta.totalPages} · {meta.total} total</p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Prev</Button>
            <Button variant="secondary" size="sm" disabled={page >= meta.totalPages} onClick={() => onPage(page + 1)}>Next →</Button>
          </div>
        </nav>
      )}
    </div>
  );
}

/* ---------- Toasts ---------- */
interface Toast { id: number; kind: 'success' | 'error' | 'info'; message: string; }
const ToastCtx = createContext<{ push: (kind: Toast['kind'], message: string) => void }>({ push: () => undefined });

let toastId = 0;
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast['kind'], message: string) => {
    const id = ++toastId;
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div aria-live="polite" className="fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`card flex items-start gap-2 border-l-4 p-3 text-sm ${t.kind === 'success' ? 'border-l-green-500' : t.kind === 'error' ? 'border-l-red-500' : 'border-l-brand-500'}`}>
            <span aria-hidden>{t.kind === 'success' ? '✅' : t.kind === 'error' ? '⛔' : 'ℹ️'}</span>
            <p className="flex-1">{t.message}</p>
            <button aria-label="Dismiss" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="text-slate-400 hover:text-slate-600">✕</button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

export function formatApiError(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const base = String((err as { message: string }).message);
    const details = (err as { details?: unknown }).details;
    const fields = extractFieldErrors(err);
    if (fields) {
      const bits = Object.entries(fields).map(([f, msgs]) => `${f}: ${msgs.join(', ')}`);
      return `${base} — ${bits.join(' · ')}`;
    }
    void details;
    return base;
  }
  return 'Request failed';
}

/**
 * I-06: surface backend Zod field errors (error.details from validateBody/
 * validateQuery → { field: string[] }). Returns null when there are none.
 */
export function extractFieldErrors(err: unknown): Record<string, string[]> | null {
  const details = err && typeof err === 'object' && 'details' in err
    ? (err as { details?: unknown }).details
    : null;
  if (details && typeof details === 'object' && !Array.isArray(details)) {
    const out: Record<string, string[]> = {};
    let found = false;
    for (const [k, v] of Object.entries(details as Record<string, unknown>)) {
      if (Array.isArray(v)) {
        const msgs = v.filter((m): m is string => typeof m === 'string');
        if (msgs.length > 0) { out[k] = msgs; found = true; }
      } else if (typeof v === 'string' && v) {
        out[k] = [v]; found = true;
      }
    }
    return found ? out : null;
  }
  return null;
}

/**
 * I-06: push backend field errors onto matching react-hook-form fields and
 * return the leftover message for a toast / form-level alert. Call in every
 * form catch block: `reportFormError(err, setError, push)` or with a
 * `setServerError` fallback for non-RHF forms.
 */
export function reportFormError(
  err: unknown,
  opts: {
    setError?: (name: string, error: { type: string; message: string }) => void;
    setServerError?: (msg: string | null) => void;
    push?: (kind: 'success' | 'error' | 'info', message: string) => void;
  } = {},
): string {
  const message = formatApiError(err);
  const fields = extractFieldErrors(err);
  if (fields && opts.setError) {
    for (const [field, msgs] of Object.entries(fields)) {
      try {
        opts.setError(field, { type: 'server', message: msgs.join(', ') });
      } catch { /* unknown field name — falls through to the toast */ }
    }
  }
  if (opts.setServerError) opts.setServerError(message);
  if (opts.push) opts.push('error', message);
  return message;
}
