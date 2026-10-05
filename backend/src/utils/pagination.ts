export type Pagination = { page: number; limit: number; skip: number };

export function parsePagination(query: Record<string, unknown>, defaultLimit = 20, maxLimit = 100): Pagination {
  const rawPage = Number(query.page ?? 1);
  const rawLimit = Number(query.limit ?? defaultLimit);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), maxLimit) : defaultLimit;
  return { page, limit, skip: (page - 1) * limit };
}

export function pageMeta(total: number, { page, limit }: Pagination) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

/** Build a Prisma orderBy from ?sort=field&order=asc|desc against an allowlist. */
export function parseSort<T extends string>(query: Record<string, unknown>, allowed: readonly T[], fallback: T): { sort: T; order: 'asc' | 'desc' } {
  const sort = allowed.includes(query.sort as T) ? (query.sort as T) : fallback;
  const order = query.order === 'asc' ? 'asc' : 'desc';
  return { sort, order };
}
