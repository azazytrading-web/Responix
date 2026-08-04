import { colorTokens } from "../tokens/colors";

export const lightTheme = {
  colors: {
    background: "#ffffff",
    foreground: "#0f172a",
    primary: colorTokens.brand[600],
    "primary-foreground": "#ffffff",
    secondary: "#f1f5f9",
    "secondary-foreground": "#0f172a",
    muted: "#f1f5f9",
    "muted-foreground": "#64748b",
    accent: "#f1f5f9",
    "accent-foreground": "#0f172a",
    destructive: "#ef4444",
    "destructive-foreground": "#ffffff",
    border: "#e2e8f0",
    input: "#e2e8f0",
    ring: colorTokens.brand[600],
    success: "#22c55e",
    warning: "#f59e0b",
    info: colorTokens.brand[500],
    "chart-1": colorTokens.brand[500],
    "chart-2": "#22c55e",
    "chart-3": "#f59e0b",
    "chart-4": "#ef4444",
    "chart-5": "#a855f7",
  },
} as const;
