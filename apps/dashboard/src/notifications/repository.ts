/**
 * Notification Repository
 */

import type { NotificationDto, NotificationFilter, NotificationUpdate } from "./types";

export interface NotificationRepository {
  getAll(): Promise<NotificationDto[]>;
  getById(id: string): Promise<NotificationDto | null>;
  getUnread(): Promise<NotificationDto[]>;
  getFiltered(filter: NotificationFilter): Promise<NotificationDto[]>;
  update(id: string, update: NotificationUpdate): Promise<NotificationDto | null>;
  updateMany(ids: string[], update: NotificationUpdate): Promise<number>;
  delete(id: string): Promise<boolean>;
  getUnreadCount(): Promise<number>;
}

export class InMemoryNotificationRepository implements NotificationRepository {
  private notifications: NotificationDto[] = [];

  constructor(initial: NotificationDto[] = []) {
    this.notifications = [...initial];
  }

  async getAll(): Promise<NotificationDto[]> {
    await Promise.resolve();
    return [...this.notifications].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getById(id: string): Promise<NotificationDto | null> {
    await Promise.resolve();
    return this.notifications.find((n) => n.id === id) ?? null;
  }

  async getUnread(): Promise<NotificationDto[]> {
    await Promise.resolve();
    return this.notifications
      .filter((n) => !n.read)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getFiltered(filter: NotificationFilter): Promise<NotificationDto[]> {
    await Promise.resolve();
    return this.notifications
      .filter((n) => {
        if (filter.read !== undefined && n.read !== filter.read) return false;
        if (filter.category && n.category !== filter.category) return false;
        if (filter.severity && n.severity !== filter.severity) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async update(id: string, update: NotificationUpdate): Promise<NotificationDto | null> {
    await Promise.resolve();
    const idx = this.notifications.findIndex((n) => n.id === id);
    if (idx === -1) return null;
    this.notifications[idx] = Object.assign({}, this.notifications[idx], update);
    return this.notifications[idx];
  }

  async updateMany(ids: string[], update: NotificationUpdate): Promise<number> {
    await Promise.resolve();
    let count = 0;
    for (const id of ids) {
      const idx = this.notifications.findIndex((n) => n.id === id);
      if (idx !== -1) {
        this.notifications[idx] = Object.assign({}, this.notifications[idx], update);
        count++;
      }
    }
    return count;
  }

  async delete(id: string): Promise<boolean> {
    await Promise.resolve();
    const before = this.notifications.length;
    this.notifications = this.notifications.filter((n) => n.id !== id);
    return this.notifications.length < before;
  }

  async getUnreadCount(): Promise<number> {
    await Promise.resolve();
    return this.notifications.filter((n) => !n.read).length;
  }

  // Test helpers
  add(notification: NotificationDto): void {
    this.notifications.push(notification);
  }

  clear(): void {
    this.notifications = [];
  }
}
