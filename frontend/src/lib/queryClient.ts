import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: false,
      // U-04: interval polling pauses while the tab is hidden (TanStack v5
      // skips refetchInterval ticks when document.visibilityState === 'hidden'
      // unless this is true). Stated explicitly so the behavior is pinned.
      refetchIntervalInBackground: false,
      retry: (count, err) => {
        const status = (err as { status?: number })?.status ?? 0;
        if (status === 401 || status === 403 || status === 404) return false;
        return count < 2;
      },
    },
  },
});
