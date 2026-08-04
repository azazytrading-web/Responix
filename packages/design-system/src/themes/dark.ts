import { colorTokens } from "../tokens/colors";

export const darkTheme = {
  colors: {
    background: "#0f172a",
    foreground: "#f8fafc",
    primary: colorTokens.brand[500],
    "primary-foreground": "#0f172a",
    secondary: "#1e293b",
    "secondary-foreground": "#f8fafc",
    muted: "#1e293b",
    "muted-foreground": "#94a3b8",
    accent: "#1e293b",
    "accent-foreground": "#f8fafc",
    destructive: "#ef4444",
    "destructive-foreground": "#ffffff",
    border: "#1e293b",
    input: "#1e293b",
    ring: colorTokens.brand[500],
    success: "#22c55e",
    warning: "#f59e0b",
    info: colorTokens.brand[400],
    "chart-1": colorTokens.brand[400],
    "chart-2": "#4ade80",
    "chart-3": "#fbbf24",
    "chart-4": "#f87171",
    "chart-5": "#c084fc",
  },
} as const;
