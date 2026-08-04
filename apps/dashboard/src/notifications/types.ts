/**
 * Notification Types
 */

export type NotificationSeverity = "info" | "success" | "warning" | "error";

export type NotificationCategory =
  | "system"
  | "conversation"
  | "workspace"
  | "agent"
  | "workflow"
  | "channel"
  | "billing"
  | "security";

export interface NotificationDto {
  id: string;
  title: string;
  message?: string;
  severity: NotificationSeverity;
  category: NotificationCategory;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
  createdAt: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationFilter {
  read?: boolean;
  category?: NotificationCategory;
  severity?: NotificationSeverity;
}

export interface NotificationUpdate {
  read?: boolean;
}
