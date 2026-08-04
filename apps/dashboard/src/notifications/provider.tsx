/**
 * Notification Provider
 *
 * React context provider for the notification system.
 */

import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { InMemoryNotificationRepository } from "./repository";
import { useNotificationStore } from "./store";
import type { NotificationDto, NotificationFilter } from "./types";

export interface NotificationContextValue {
  notifications: NotificationDto[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  filtered: (filter: NotificationFilter) => NotificationDto[];
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const repository = useMemo(() => new InMemoryNotificationRepository(), []);
  const store = useNotificationStore(repository);

  return (
    <NotificationContext.Provider value={store}>{children}</NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}

export function useNotificationCount(): number {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotificationCount must be used within NotificationProvider");
  return ctx.unreadCount;
}
