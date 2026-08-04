import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: (failureCount: number, error: unknown) => {
        if (error instanceof Error && error.message.includes("Network")) {
          return failureCount < 3;
        }
        return false;
      },
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: (failureCount: number, error: unknown) => {
        if (error instanceof Error && error.message.includes("Network")) {
          return failureCount < 2;
        }
        return false;
      },
    },
  },
});
