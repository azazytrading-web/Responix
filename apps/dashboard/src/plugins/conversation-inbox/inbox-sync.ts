// ---------------------------------------------------------------------------
// Pure helpers for the live Inbox: deterministic conversation ordering,
// de-duplicated message merging, and the read-boundary unread model.
// ---------------------------------------------------------------------------
//
// Unread model (client-side read boundary):
// The Channel Runtime backend exposes no operator read state for conversations
// (ChannelMessage.readAt is the customer's delivery receipt, not ours), so the
// unread counter is derived from a per-conversation read boundary: each
// conversation is baselined the first time it appears in the list, and only
// customer (INCOMING) messages that arrive afterwards count as unread. The
// boundary is persisted to localStorage per workspace (see inbox-read-state.ts),
// so unread counts survive navigation, refresh and browser reinitialization;
// it is never presented as server-side read state.
// ---------------------------------------------------------------------------

import type { InboxConversationRecord, InboxMessageRecord } from "./inbox-api";

export function timestampMs(value?: string | null): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

/** Canonical last activity: lastMessageAt (newest message) with updatedAt as fallback. */
export function conversationActivityMs(conversation: InboxConversationRecord): number {
  return timestampMs(conversation.lastMessageAt ?? conversation.updatedAt);
}

/**
 * WhatsApp-style ordering: newest activity first. Ties on activity break on
 * conversation id (ascending) so the order is deterministic across refetches.
 */
export function sortConversations(
  conversations: InboxConversationRecord[]
): InboxConversationRecord[] {
  return [...conversations].sort((a, b) => {
    const aActivity = conversationActivityMs(a);
    const bActivity = conversationActivityMs(b);
    if (aActivity !== bActivity) return bActivity - aActivity;
    if (a.id !== b.id) return a.id < b.id ? -1 : 1;
    return 0;
  });
}

/** Canonical creation time used for ordering and unread comparisons. */
function messageOrderMs(message: InboxMessageRecord): number {
  return timestampMs(message.createdAt);
}

/**
 * Merges freshly fetched messages into the existing list, de-duplicating by
 * canonical message id. When the same id arrives twice, the record with the
 * newer updatedAt wins (delivery/read state transitions). The result is
 * sorted oldest-first, which is the rendered order.
 */
export function mergeMessages(
  existing: InboxMessageRecord[],
  incoming: InboxMessageRecord[]
): InboxMessageRecord[] {
  const byId = new Map<string, InboxMessageRecord>();
  for (const message of existing) byId.set(message.id, message);
  for (const message of incoming) {
    const previous = byId.get(message.id);
    if (!previous || timestampMs(message.updatedAt) >= timestampMs(previous.updatedAt)) {
      byId.set(message.id, message);
    }
  }
  return [...byId.values()].sort((a, b) => {
    const aTime = messageOrderMs(a);
    const bTime = messageOrderMs(b);
    if (aTime !== bTime) return aTime - bTime;
    if (a.id !== b.id) return a.id < b.id ? -1 : 1;
    return 0;
  });
}

/** Counts customer messages for one conversation that arrived after `lastReadAtMs`. */
export function countUnreadSince(
  messages: InboxMessageRecord[],
  conversationId: string,
  lastReadAtMs: number
): number {
  return messages.filter(
    (message) =>
      message.conversationId === conversationId &&
      message.direction === "INCOMING" &&
      messageOrderMs(message) > lastReadAtMs
  ).length;
}

/** Newest message time (ms) in a list, or 0 when empty. */
export function newestMessageTime(messages: InboxMessageRecord[]): number {
  return messages.reduce((max, message) => Math.max(max, messageOrderMs(message)), 0);
}

/** Display formatting for unread counters with a 99+ cap. */
export function displayUnreadCount(count: number): string {
  if (count <= 0) return "0";
  return count > 99 ? "99+" : String(count);
}
