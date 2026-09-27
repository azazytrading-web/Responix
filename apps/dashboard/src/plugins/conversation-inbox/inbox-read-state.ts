// ---------------------------------------------------------------------------
// Workspace-scoped read boundaries for the live Inbox unread model.
// The Channel Runtime backend exposes no operator read state, so each
// conversation's read boundary (a timestamp) is persisted to localStorage,
// keyed by workspace. Unread = customer (INCOMING) messages that arrived
// after the boundary. The boundary only moves when the user opens a
// conversation or reads a message while it is open — never on mount,
// navigation, refresh, refetch or browser reinitialization — so unread
// counts survive all of those.
// ---------------------------------------------------------------------------

const STORAGE_KEY_PREFIX = "responix.inbox.readBoundary.v1.";

/** localStorage key for the persisted unread boundaries of one workspace. */
export function inboxReadStateKey(workspaceId: string): string {
  return `${STORAGE_KEY_PREFIX}${workspaceId}`;
}

/**
 * Loads the persisted read boundaries for a workspace. Returns an empty map
 * when storage is unavailable or the stored value is malformed, so the inbox
 * degrades to a fresh session instead of failing.
 */
export function loadInboxReadState(workspaceId: string): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(inboxReadStateKey(workspaceId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "number" && Number.isFinite(value) && value > 0) result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

/**
 * Persists the read boundaries for a workspace. Storage failures (private
 * mode, quota) are swallowed: the unread model then falls back to the
 * in-memory session behavior instead of breaking the inbox.
 */
export function saveInboxReadState(workspaceId: string, state: Record<string, number>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(inboxReadStateKey(workspaceId), JSON.stringify(state));
  } catch {
    // Best-effort persistence; the unread model stays functional in memory.
  }
}
