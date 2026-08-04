/**
 * Notification Store
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { NotificationDto, NotificationFilter } from "./types";
import type { NotificationRepository } from "./repository";
import type { NotificationTransport } from "./transport";

export interface NotificationStoreState {
  notifications: NotificationDto[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
}

export function useNotificationStore(
  repository: NotificationRepository,
  transport?: NotificationTransport
) {
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeSet = useCallback(<T,>(setter: (value: T) => void, value: T) => {
    if (isMountedRef.current) {
      setter(value);
    }
  }, []);

  const refresh = useCallback(async () => {
    safeSet(setIsLoading, true);
    safeSet(setError, null);
    try {
      const [all, count] = await Promise.all([
        repository.getAll(),
        repository.getUnreadCount(),
      ]);
      safeSet(setNotifications, all);
      safeSet(setUnreadCount, count);
    } catch (err) {
      safeSet(setError, err instanceof Error ? err.message : String(err));
    } finally {
      safeSet(setIsLoading, false);
    }
  }, [repository, safeSet]);

  const markAsRead = useCallback(
    async (id: string) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        await repository.update(id, { read: true });
      } catch (err) {
        safeSet(setError, err instanceof Error ? err.message : String(err));
        void refresh();
      }
    },
    [repository, refresh, safeSet]
  );

  const markAllAsRead = useCallback(async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);

    try {
      await repository.updateMany(unreadIds, { read: true });
    } catch (err) {
      safeSet(setError, err instanceof Error ? err.message : String(err));
      void refresh();
    }
  }, [notifications, repository, refresh, safeSet]);

  const dismiss = useCallback(
    async (id: string) => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setUnreadCount((prev) => {
        const wasUnread = notifications.find((n) => n.id === id && !n.read);
        return wasUnread ? Math.max(0, prev - 1) : prev;
      });

      try {
        await repository.delete(id);
      } catch (err) {
        safeSet(setError, err instanceof Error ? err.message : String(err));
        void refresh();
      }
    },
    [notifications, repository, refresh, safeSet]
  );

  const filtered = useCallback(
    (filter: NotificationFilter) => {
      return notifications.filter((n) => {
        if (filter.read !== undefined && n.read !== filter.read) return false;
        if (filter.category && n.category !== filter.category) return false;
        if (filter.severity && n.severity !== filter.severity) return false;
        return true;
      });
    },
    [notifications]
  );

  // Transport integration
  useEffect(() => {
    if (!transport) return;

    transport.onMessage((notification) => {
      setNotifications((prev) => [notification, ...prev]);
      if (!notification.read) {
        setUnreadCount((prev) => prev + 1);
      }
    });

    transport.onError((err) => {
      safeSet(setError, err.message);
    });

    transport.connect();

    return () => {
      transport.disconnect();
    };
  }, [transport, safeSet]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    refresh,
    markAsRead,
    markAllAsRead,
    dismiss,
    filtered,
  };
}
