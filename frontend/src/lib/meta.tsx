import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { apiGet } from './api-client.ts';
import type { AppMeta, ColorKey, EnumOption, MetaGroup } from './types.ts';

/** Canonical color-key → Tailwind badge classes (light + dark). Single mapping for the whole app. */
const COLOR_CLASSES: Record<ColorKey, string> = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600',
  gray: 'bg-gray-100 text-gray-600 ring-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600',
  red: 'bg-red-100 text-red-700 ring-red-300 dark:bg-red-950 dark:text-red-300 dark:ring-red-800',
  orange: 'bg-orange-100 text-orange-700 ring-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:ring-orange-800',
  amber: 'bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-800',
  green: 'bg-green-100 text-green-700 ring-green-300 dark:bg-green-950 dark:text-green-300 dark:ring-green-800',
  blue: 'bg-blue-100 text-blue-700 ring-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-800',
  indigo: 'bg-indigo-100 text-indigo-700 ring-indigo-300 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-indigo-800',
  violet: 'bg-violet-100 text-violet-700 ring-violet-300 dark:bg-violet-950 dark:text-violet-300 dark:ring-violet-800',
  cyan: 'bg-cyan-100 text-cyan-700 ring-cyan-300 dark:bg-cyan-950 dark:text-cyan-300 dark:ring-cyan-800',
  pink: 'bg-pink-100 text-pink-700 ring-pink-300 dark:bg-pink-950 dark:text-pink-300 dark:ring-pink-800',
  lime: 'bg-lime-100 text-lime-700 ring-lime-300 dark:bg-lime-950 dark:text-lime-300 dark:ring-lime-800',
};

/** Marker fill colors for Leaflet (hex, by priority). */
export const PRIORITY_DOT: Record<string, string> = { CRITICAL: '#dc2626', HIGH: '#ea580c', MEDIUM: '#d97706', LOW: '#16a34a' };

interface MetaCtx {
  meta: AppMeta | undefined;
  isLoading: boolean;
  isError: boolean;
  options: (group: MetaGroup) => EnumOption[];
  option: (group: MetaGroup, value: string | null | undefined) => EnumOption;
  label: (group: MetaGroup, value: string | null | undefined) => string;
  badgeClass: (group: MetaGroup, value: string | null | undefined) => string;
}

const Ctx = createContext<MetaCtx | null>(null);

export function MetaProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['meta'],
    queryFn: () => apiGet<AppMeta>('/meta'),
    staleTime: Infinity,
    retry: 3,
  });

  const value = useMemo<MetaCtx>(() => {
    const options = (group: MetaGroup): EnumOption[] => data?.[group] as EnumOption[] ?? [];
    const option = (group: MetaGroup, v: string | null | undefined): EnumOption =>
      options(group).find((o) => o.value === v) ?? { value: v ?? '—', label: v ?? '—', color: 'slate' as ColorKey };
    return {
      meta: data,
      isLoading,
      isError,
      options,
      option,
      label: (g, v) => option(g, v).label,
      badgeClass: (g, v) => COLOR_CLASSES[option(g, v).color] ?? COLOR_CLASSES.slate,
    };
  }, [data, isLoading, isError]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMeta(): MetaCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useMeta must be used inside MetaProvider');
  return ctx;
}

export function colorClasses(color: ColorKey): string {
  return COLOR_CLASSES[color] ?? COLOR_CLASSES.slate;
}
