/**
 * Mock Query Client
 *
 * Test utility providing an isolated QueryClient for each test.
 */

import { QueryClient } from "@tanstack/react-query";

export function createMockQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
  });
}
