import { baseConfig } from "@responix/config/eslint";

export default [
  ...baseConfig,
  {
    ignores: [".next-x16-*/**"],
  },
];
