import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,            // data fresh for 30s — no refetch on remount
        gcTime: 5 * 60_000,           // keep cache 5 min
        refetchOnWindowFocus: false,  // stop aggressive refetching
        refetchOnMount: false,        // use cache when route remounts
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",         // preload on hover/focus, not on every render
    defaultPendingMs: 0,
    defaultPendingMinMs: 0,
    defaultPreloadStaleTime: 30_000,  // reuse preload data for 30s instead of re-fetching
  });

  return router;
};
