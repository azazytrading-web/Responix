/**
 * Mock Router
 */

import { vi, type Mock } from "vitest";

export const mockRouter: {
  push: Mock;
  replace: Mock;
  refresh: Mock;
  back: Mock;
  forward: Mock;
  prefetch: Mock;
} = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
};

export function mockUsePathname(pathname: string): () => string {
  return () => pathname;
}

export function mockUseRouter(): typeof mockRouter {
  return mockRouter;
}
