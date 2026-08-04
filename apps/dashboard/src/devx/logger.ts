/**
 * Development Logger
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

class DevLogger {
  private isDev: boolean;
  private history: LogEntry[] = [];
  private maxHistory = 100;

  constructor() {
    this.isDev = process.env.NODE_ENV === "development";
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
    };

    this.history.push(entry);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    if (this.isDev) {
      const prefix = `[${level.toUpperCase()}]`;
      if (context) {
        console.log(prefix, message, context);
      } else {
        console.log(prefix, message);
      }
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log("debug", message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log("info", message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log("warn", message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log("error", message, context);
  }

  getHistory(): readonly LogEntry[] {
    return this.history;
  }

  clear(): void {
    this.history = [];
  }
}

export const logger = new DevLogger();
