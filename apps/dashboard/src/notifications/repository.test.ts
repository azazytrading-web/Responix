import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryNotificationRepository } from "./repository";
import type { NotificationDto } from "./types";

function createNotification(overrides: Partial<NotificationDto> = {}): NotificationDto {
  return {
    id: `notif-${Math.random().toString(36).slice(2)}`,
    title: "Test Notification",
    severity: "info",
    category: "system",
    read: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("NotificationRepository", () => {
  let repo: InMemoryNotificationRepository;

  beforeEach(() => {
    repo = new InMemoryNotificationRepository();
  });

  it("returns empty array initially", async () => {
    const all = await repo.getAll();
    expect(all).toEqual([]);
  });

  it("stores and retrieves notifications", async () => {
    const notif = createNotification({ title: "Hello" });
    repo.add(notif);
    const all = await repo.getAll();
    expect(all).toHaveLength(1);
    expect(all[0]?.title).toBe("Hello");
  });

  it("counts unread notifications", async () => {
    repo.add(createNotification({ read: false }));
    repo.add(createNotification({ read: false }));
    repo.add(createNotification({ read: true }));
    const count = await repo.getUnreadCount();
    expect(count).toBe(2);
  });

  it("marks notification as read", async () => {
    const notif = createNotification({ read: false });
    repo.add(notif);
    const updated = await repo.update(notif.id, { read: true });
    expect(updated?.read).toBe(true);
  });

  it("deletes a notification", async () => {
    const notif = createNotification();
    repo.add(notif);
    const deleted = await repo.delete(notif.id);
    expect(deleted).toBe(true);
    const all = await repo.getAll();
    expect(all).toHaveLength(0);
  });

  it("filters by category", async () => {
    repo.add(createNotification({ category: "system" }));
    repo.add(createNotification({ category: "conversation" }));
    const filtered = await repo.getFiltered({ category: "system" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.category).toBe("system");
  });
});
