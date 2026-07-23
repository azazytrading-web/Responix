import eslint from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import path from "node:path";
import tseslint from "typescript-eslint";

const isApiPackage = process.cwd().endsWith(`${path.sep}apps${path.sep}api`);
const isDashboardPackage = process
  .cwd()
  .endsWith(`${path.sep}apps${path.sep}dashboard`);

export const baseConfig = [
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/coverage/**",
      "**/.turbo/**",
      "**/next-env.d.ts",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ["**/*.{ts,tsx}"],
  })),
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: isApiPackage
          ? { allowDefaultProject: ["jest.config.ts"] }
          : true,
        tsconfigRootDir: process.cwd(),
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
        },
      ],
    },
  },
  {
    files: isDashboardPackage
      ? ["**/*.{ts,tsx}"]
      : ["apps/dashboard/**/*.{ts,tsx}"],
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
];
