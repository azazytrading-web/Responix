import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/testing/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "@responix/auth": path.resolve(import.meta.dirname, "../../packages/auth/src"),
      "@responix/ui": path.resolve(import.meta.dirname, "../../packages/ui/src"),
      "@responix/types": path.resolve(import.meta.dirname, "../../packages/types/src"),
      "@responix/api-client": path.resolve(import.meta.dirname, "../../packages/api-client/src"),
      "@responix/state": path.resolve(import.meta.dirname, "../../packages/state/src"),
      "@responix/design-system": path.resolve(import.meta.dirname, "../../packages/design-system/src"),
      "@responix/shared": path.resolve(import.meta.dirname, "../../packages/shared/src"),
      "@responix/utils": path.resolve(import.meta.dirname, "../../packages/utils/src"),
    },
  },
});
