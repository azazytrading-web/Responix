export const colorTokens = {
  base: {
    white: "#FFFFFF",
    black: "#000000",
  },
  brand: {
    50: "#eff6ff",
    100: "#dbeafe",
    200: "#bfdbfe",
    300: "#93c5fd",
    400: "#60a5fa",
    500: "#3b82f6",
    600: "#2563eb",
    700: "#1d4ed8",
    800: "#1e40af",
    900: "#1e3a8a",
    950: "#172554",
  },
  semantic: {
    background: "var(--color-background)",
    foreground: "var(--color-foreground)",
    primary: {
      DEFAULT: "var(--color-primary)",
      foreground: "var(--color-primary-foreground)",
    },
    secondary: {
      DEFAULT: "var(--color-secondary)",
      foreground: "var(--color-secondary-foreground)",
    },
    muted: {
      DEFAULT: "var(--color-muted)",
      foreground: "var(--color-muted-foreground)",
    },
    accent: {
      DEFAULT: "var(--color-accent)",
      foreground: "var(--color-accent-foreground)",
    },
    destructive: {
      DEFAULT: "var(--color-destructive)",
      foreground: "var(--color-destructive-foreground)",
    },
    border: "var(--color-border)",
    input: "var(--color-input)",
    ring: "var(--color-ring)",
    success: "var(--color-success)",
    warning: "var(--color-warning)",
    info: "var(--color-info)",
  },
  chart: {
    1: "var(--chart-1)",
    2: "var(--chart-2)",
    3: "var(--chart-3)",
    4: "var(--chart-4)",
    5: "var(--chart-5)",
  },
} as const;
