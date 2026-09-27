"use client";

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ApiError } from "@responix/api-client";
import { queryClient } from "@responix/state";
import { Avatar, Badge, Button, EmptyState, ErrorFallback, Textarea } from "@responix/ui";
import { Check, CheckCheck, ChevronDown, Clock, MessageSquare, Send, XCircle, FileText, Image as ImageIcon, UserRound } from "lucide-react";
import {
  getInboxAttachment, sendInboxMessage, setConversationExecution,
  type InboxAgentRecord, type InboxChannelRecord, type InboxConnectionRecord,
  type InboxConversationRecord, type InboxMessageRecord
} from "./inbox-api";
import { displayUnreadCount, sortConversations } from "./inbox-sync";

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

function formatTime(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatSize(value?: number | string | null): string {
  const bytes = Number(value ?? 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Best-effort display name from provider metadata; falls back to the external conversation id. */
function customerDisplayName(conversation: InboxConversationRecord): string {
  const metadata = conversation.metadata ?? {};
  for (const key of ["pushName", "displayName", "name"]) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return conversation.externalConversationId;
}

/** Display text for a message: normalized text, then attachment caption, then type label. */
function messageText(message: InboxMessageRecord): string {
  const payload = message.normalizedPayload;
  if (payload?.text && payload.text.trim().length > 0) return payload.text;
  const caption = payload?.attachments?.find((a) => typeof a.caption === "string" && a.caption.trim().length > 0)?.caption;
  if (caption) return caption;
  if (message.type === "TEXT") return "(empty message)";
  return message.type ?? "Message";
}

function messageTime(message: InboxMessageRecord): string {
  return formatTime(message.normalizedPayload?.timestamp ?? message.sentAt ?? message.createdAt);
}

function ConversationListItem({
  conversation, channel, selected, unreadCount, onSelect
}: {
  conversation: InboxConversationRecord;
  channel?: InboxChannelRecord;
  selected: boolean;
  unreadCount: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`conversation-item-${conversation.id}`}
      aria-pressed={selected}
      className={`w-full rounded-md px-3 py-2 text-left transition-colors ${
        selected ? "bg-primary/10" : "hover:bg-accent"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          {conversation.agentExecutionEnabled === false && (
            <span
              data-testid={`responix-off-${conversation.id}`}
              className="h-2 w-2 shrink-0 rounded-full bg-destructive"
              title="Responix is disabled for this conversation"
              aria-label="Responix is disabled for this conversation"
            />
          )}
          <p className="truncate text-sm font-medium">{customerDisplayName(conversation)}</p>
          {unreadCount > 0 && (
            <Badge
              data-testid={`unread-badge-${conversation.id}`}
              className="h-5 shrink-0 px-1.5"
              aria-label={`${unreadCount} unread messages`}
            >
              {displayUnreadCount(unreadCount)}
            </Badge>
          )}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatTime(conversation.lastMessageAt ?? conversation.updatedAt)}
        </span>
      </div>
      <p className="truncate text-xs text-muted-foreground">
        {channel ? `${channel.name} · ${channel.provider.name}` : "Channel unavailable"}
      </p>
    </button>
  );
}

function OutboundStatusBadge({ message }: { message: InboxMessageRecord }) {
  const state = message.state;
  if (state === "FAILED" || state === "EXPIRED" || state === "CANCELLED") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-destructive" data-testid="message-status">
        <XCircle className="h-3.5 w-3.5" /> {state}
      </span>
    );
  }
  if (state === "READ") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-primary" data-testid="message-status">
        <CheckCheck className="h-3.5 w-3.5" /> Read
      </span>
    );
  }
  if (state === "DELIVERED" || state === "SENT") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" data-testid="message-status">
        <CheckCheck className="h-3.5 w-3.5" /> {state === "DELIVERED" ? "Delivered" : "Sent"}
      </span>
    );
  }
  if (state === "QUEUED" || state === "PREPARING" || state === "SENDING") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" data-testid="message-status">
        <Clock className="h-3.5 w-3.5" /> {state}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" data-testid="message-status">
      <Check className="h-3.5 w-3.5" /> {state}
    </span>
  );
}

function ImagePreview({ attachmentId }: { attachmentId: string }) {
  const query = useQuery({
    queryKey: [`inbox-attachment`, attachmentId],
    queryFn: () => getInboxAttachment(attachmentId)
  });
  if (query.isPending || !query.data?.content) return null;
  return (
    <img
      src={`data:${query.data.mimeType};base64,${query.data.content}`}
      alt={query.data.fileName ?? "attachment"}
      className="mt-1 max-h-56 rounded-md"
    />
  );
}

export function MessageBubble({ message }: { message: InboxMessageRecord }) {
  const incoming = message.direction === "INCOMING";
  const text = messageText(message);
  const attachment = message.attachments[0];
  const isImage = message.type === "IMAGE";
  return (
    <div className={`flex ${incoming ? "justify-start" : "justify-end"}`}>
      <div
        data-testid={`message-bubble-${message.id}`}
        className={`max-w-[75%] rounded-lg px-3 py-2 text-sm shadow-sm ${
          incoming
            ? "bg-card border border-border"
            : "bg-primary text-primary-foreground"
        }`}
      >
        <p className={`mb-1 text-xs font-medium ${incoming ? "text-muted-foreground" : "text-primary-foreground/80"}`}>
          {incoming ? "Customer" : "Agent"} · {formatTime(messageTime(message))}
        </p>
        {isImage && attachment ? (
          <>
            <ImagePreview attachmentId={attachment.id} />
            <p className="mt-1 break-words">{text}</p>
          </>
        ) : (
          <p className="whitespace-pre-wrap break-words">{text}</p>
        )}
        {!isImage && attachment && (
          <span className={`mt-1 flex items-center gap-1 text-xs ${incoming ? "text-muted-foreground" : "text-primary-foreground/80"}`}>
            {attachment.mimeType.startsWith("image/") ? (
              <ImageIcon className="h-3.5 w-3.5" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            {attachment.fileName ?? attachment.mimeType}
            {formatSize(attachment.sizeBytes) && ` · ${formatSize(attachment.sizeBytes)}`}
          </span>
        )}
        <div className={`mt-1 flex justify-end ${incoming ? "" : "text-primary-foreground/80"}`}>
          {incoming ? <span className="text-xs text-muted-foreground">{message.state}</span> : <OutboundStatusBadge message={message} />}
        </div>
      </div>
    </div>
  );
}

const NEAR_BOTTOM_THRESHOLD_PX = 80;

/**
 * Scrollable message viewport with WhatsApp-style sync behavior:
 * - landing on a conversation starts at the newest message;
 * - new messages auto-scroll only while the user is already at the bottom;
 * - otherwise a "N new messages" chip offers an explicit jump down;
 * - loading older history preserves the current reading position (anchor),
 *   so the list does not jump when older messages are prepended.
 */
export function MessageList({
  messages, conversationKey, hasOlder, loadingOlder, onLoadOlder
}: {
  messages: InboxMessageRecord[];
  /** Stable identity of the conversation being shown (drives "new conversation" behavior). */
  conversationKey: string;
  hasOlder: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const initializedRef = useRef(false);
  const prevConversationRef = useRef(conversationKey);
  const prevCountRef = useRef(messages.length);
  const prevFirstIdRef = useRef(messages[0]?.id);
  const prevScrollHeightRef = useRef(0);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottomNow = distanceFromBottom <= NEAR_BOTTOM_THRESHOLD_PX;
    setAtBottom(atBottomNow);
    if (atBottomNow) setNewCount(0);
  };

  const scrollToBottom = (smooth: boolean) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    setAtBottom(true);
    setNewCount(0);
  };

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const firstId = messages[0]?.id;
    const conversationChanged = prevConversationRef.current !== conversationKey;
    const prepended = !conversationChanged && firstId !== prevFirstIdRef.current;
    const appended = !conversationChanged && !prepended && messages.length > prevCountRef.current;

    if (!initializedRef.current || conversationChanged) {
      // Initial load / switching conversations: land on the newest message.
      scrollToBottom(false);
    } else if (prepended) {
      // Older history prepended: keep the same visual message in view.
      el.scrollTop += el.scrollHeight - prevScrollHeightRef.current;
    } else if (appended) {
      if (atBottom) {
        scrollToBottom(false);
      } else {
        setNewCount((current) => current + (messages.length - prevCountRef.current));
      }
    }

    initializedRef.current = true;
    prevConversationRef.current = conversationKey;
    prevCountRef.current = messages.length;
    prevFirstIdRef.current = firstId;
    prevScrollHeightRef.current = el.scrollHeight;
  }, [messages, conversationKey, atBottom]);

  return (
    <div className="relative min-h-0 flex-1" data-testid="message-list">
      <div ref={scrollRef} onScroll={handleScroll} className="h-full overflow-auto p-4">
        {messages.length === 0 ? (
          <EmptyState
            title="No messages yet"
            description="Messages for this conversation will appear here once the channel delivers them."
            icon={<MessageSquare className="h-5 w-5" />}
          />
        ) : (
          <div className="space-y-3">
            {hasOlder && (
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loadingOlder}
                  onClick={onLoadOlder}
                  data-testid="load-older"
                >
                  {loadingOlder ? "Loading…" : "Load older messages"}
                </Button>
              </div>
            )}
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
        )}
      </div>
      {newCount > 0 && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          data-testid="new-messages-chip"
          aria-label={`Jump to ${newCount} new message${newCount === 1 ? "" : "s"}`}
          className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-md hover:bg-primary/90"
        >
          <ChevronDown className="h-3.5 w-3.5" />
          {newCount} new message{newCount === 1 ? "" : "s"}
        </button>
      )}
    </div>
  );
}

export function ConversationList({
  conversations, channels, selectedId, unread, syncDegraded, onSelect
}: {
  conversations: InboxConversationRecord[];
  channels: InboxChannelRecord[];
  selectedId: string | null;
  /** Session-scoped unread counts (customer messages since the conversation was last read). */
  unread: Record<string, number>;
  /** Live conversation sync is temporarily failing; stale data is still shown. */
  syncDegraded?: boolean;
  onSelect: (id: string) => void;
}) {
  const [channelFilter, setChannelFilter] = useState<string>("");
  const channelById = new Map(channels.map((channel) => [channel.id, channel]));
  // WhatsApp-style ordering: newest activity first; the selection itself is
  // owned by the page, so reordering never changes what is selected.
  const sorted = sortConversations(conversations);
  const visible = channelFilter
    ? sorted.filter((conversation) => conversation.channelId === channelFilter)
    : sorted;

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="conversation-list">
      {syncDegraded && (
        <p className="border-b border-border bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground" data-testid="conversation-sync-status">
          Live sync temporarily unavailable — showing the last synced conversations.
        </p>
      )}
      <div className="border-b border-border p-3">
        <label htmlFor="inbox-channel-filter" className="mb-1 block text-xs font-medium text-muted-foreground">
          Channel
        </label>
        <select
          id="inbox-channel-filter"
          value={channelFilter}
          onChange={(event) => setChannelFilter(event.target.value)}
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        >
          <option value="">All channels</option>
          {channels.map((channel) => (
            <option key={channel.id} value={channel.id}>{channel.name}</option>
          ))}
        </select>
      </div>
      <div className="flex-1 overflow-auto p-2">
        {visible.length === 0 ? (
          <EmptyState
            title="No conversations"
            description={channelFilter ? "No conversations for this channel yet." : "Inbound channel messages will appear here."}
            icon={<MessageSquare className="h-5 w-5" />}
          />
        ) : (
          <ul className="space-y-1">
            {visible.map((conversation) => (
              <li key={conversation.id}>
                <ConversationListItem
                  conversation={conversation}
                  channel={channelById.get(conversation.channelId)}
                  selected={conversation.id === selectedId}
                  unreadCount={unread[conversation.id] ?? 0}
                  onSelect={() => onSelect(conversation.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ContextRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm">{value}</div>
    </div>
  );
}

/**
 * Conversation-level Responix execution switch. The displayed state is always
 * the canonical server value (conversation.agentExecutionEnabled); on success
 * the conversations query is invalidated so the UI re-renders from the
 * refetched state. Failures keep the last known state and surface inline —
 * the UI never claims a pending change succeeded.
 */
function ResponixExecutionControl({
  conversation, enabled, canControl, conversationsKey
}: {
  conversation: InboxConversationRecord;
  enabled: boolean;
  canControl: boolean;
  conversationsKey: readonly unknown[];
}) {
  const [failure, setFailure] = useState("");

  const mutation = useMutation({
    mutationFn: (next: boolean) => setConversationExecution(conversation.id, next),
    onSuccess: () => {
      setFailure("");
      void queryClient.invalidateQueries({ queryKey: conversationsKey });
    },
    onError: (error) => setFailure(errorMessage(error, "The Responix state could not be updated."))
  });

  return (
    <ContextRow
      label="Responix for this conversation"
      value={
        <span className="flex flex-wrap items-center gap-2">
          <Badge variant={enabled ? "default" : "secondary"} data-testid="responix-state">
            {enabled ? "ON" : "OFF"}
          </Badge>
          {canControl && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={mutation.isPending}
              aria-pressed={enabled}
              aria-label={enabled ? "Disable Responix for this conversation" : "Enable Responix for this conversation"}
              onClick={() => { void mutation.mutateAsync(!enabled); }}
              data-testid="responix-toggle"
            >
              {mutation.isPending ? "Updating…" : enabled ? "Disable" : "Enable"}
            </Button>
          )}
          {failure && <span role="alert" className="text-xs text-destructive">{failure}</span>}
        </span>
      }
    />
  );
}

/**
 * Compact WhatsApp-style chat header. The identity (avatar + name +
 * identifier) is a single accessible button that opens the conversation
 * information panel; the rest of the header is not clickable.
 */
function ConversationHeader({
  conversation, channel, executionEnabled, onOpenProfile
}: {
  conversation: InboxConversationRecord;
  channel?: InboxChannelRecord;
  /** Canonical conversation-level Responix execution state from the server. */
  executionEnabled: boolean;
  onOpenProfile: () => void;
}) {
  const name = customerDisplayName(conversation);
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2.5" data-testid="conversation-header">
      <button
        type="button"
        onClick={onOpenProfile}
        aria-haspopup="dialog"
        aria-label={`Open information for ${name}`}
        data-testid="conversation-identity"
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent"
      >
        <Avatar fallback={name} />
        <span className="flex min-w-0 flex-col">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold">{name}</span>
            {executionEnabled === false && (
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-destructive"
                title="Responix is disabled for this conversation"
                aria-label="Responix is disabled for this conversation"
              />
            )}
          </span>
          <span className="truncate font-mono text-xs text-muted-foreground">{conversation.externalConversationId}</span>
        </span>
      </button>
      {channel && (
        <span className="hidden shrink-0 text-xs text-muted-foreground md:block">
          {channel.name} · {channel.provider.name}
        </span>
      )}
      <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </div>
  );
}

/**
 * Customer/conversation information panel, opened from the chat header
 * identity. A right-anchored drawer over the inbox: the conversation list and
 * chat stay visible behind it, and it closes on backdrop click or Escape.
 *
 * Real data only — every field below comes from the inbox contracts the page
 * already loads (conversation, channel, connection, agent-studio binding). No
 * backend capability is invented here.
 */
export function ConversationProfile({
  conversation, channel, connection, boundAgent, executionEnabled, canControlExecution, conversationsKey, onClose
}: {
  conversation: InboxConversationRecord;
  channel?: InboxChannelRecord;
  connection?: InboxConnectionRecord;
  boundAgent?: InboxAgentRecord;
  /** Canonical conversation-level Responix execution state from the server. */
  executionEnabled: boolean;
  canControlExecution: boolean;
  conversationsKey: readonly unknown[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" data-testid="conversation-profile">
      <button
        type="button"
        aria-label="Close conversation information"
        className="absolute inset-0 cursor-default bg-background/60"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Conversation information"
        className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-background shadow-xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Conversation information</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close conversation details"
            onClick={onClose}
            data-testid="conversation-profile-close"
          >
            <XCircle className="h-4 w-4" />
          </Button>
        </header>
        <div className="flex flex-col gap-5 p-4">
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer</h3>
            <div className="flex items-center gap-3">
              <Avatar fallback={customerDisplayName(conversation)} className="h-12 w-12" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{customerDisplayName(conversation)}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">{conversation.externalConversationId}</p>
              </div>
            </div>
            <ContextRow label="Conversation ID" value={<span className="break-all font-mono text-xs">{conversation.id}</span>} />
            <ContextRow label="Session" value={<span className="break-all font-mono text-xs">{conversation.sessionId}</span>} />
          </section>
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conversation</h3>
            <ContextRow
              label="Channel"
              value={channel ? `${channel.name} (${channel.provider.name})` : "Unavailable"}
            />
            {connection && (
              <ContextRow
                label="Connection"
                value={
                  <span className="flex items-center gap-2">
                    <span>{connection.displayPhoneNumber ?? connection.phoneNumberId ?? connection.id}</span>
                    <Badge variant={connection.state === "CONNECTED" ? "default" : "secondary"}>
                      {connection.state}
                    </Badge>
                  </span>
                }
              />
            )}
            {conversation.conversationRuntimeId && (
              <ContextRow
                label="Conversation runtime"
                value={<span className="break-all font-mono text-xs">{conversation.conversationRuntimeId}</span>}
              />
            )}
            <ContextRow
              label="Last activity"
              value={formatTime(conversation.lastMessageAt ?? conversation.updatedAt) || "—"}
            />
          </section>
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Responix</h3>
            <ResponixExecutionControl
              conversation={conversation}
              enabled={executionEnabled}
              canControl={canControlExecution}
              conversationsKey={conversationsKey}
            />
            <ContextRow
              label="Responix bound to this channel"
              value={boundAgent ? (
                <span className="flex items-center gap-2">
                  <span className="font-medium">{boundAgent.name}</span>
                  <Badge variant="secondary">{boundAgent.status}</Badge>
                </span>
              ) : "No Responix is bound to this channel"}
            />
          </section>
        </div>
      </aside>
    </div>
  );
}

export function SendBox({
  channelId, connection, recipient, canSend, onSent
}: {
  channelId: string;
  connection?: InboxConnectionRecord;
  recipient: string;
  canSend: boolean;
  onSent?: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [failure, setFailure] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      sendInboxMessage(channelId, {
        connectionId: connection!.id,
        recipient,
        text: draft.trim(),
        idempotencyKey: (globalThis.crypto?.randomUUID?.() ?? `send-${Date.now()}`)
      }),
    onSuccess: () => {
      setDraft("");
      setFailure("");
      onSent?.();
    },
    onError: (error) => setFailure(errorMessage(error, "The message could not be sent."))
  });

  const disabled = !canSend || !connection || draft.trim().length === 0 || mutation.isPending;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (disabled) return;
    void mutation.mutateAsync();
  };

  return (
    <form className="flex items-end gap-2 border-t border-border p-3" noValidate onSubmit={submit}>
      <Textarea
        id="inbox-send"
        value={draft}
        placeholder={canSend && connection ? "Reply to this conversation" : "Sending is not available"}
        aria-label="Reply to this conversation"
        maxLength={4096}
        rows={2}
        disabled={!canSend || !connection}
        onChange={(event) => setDraft(event.target.value)}
      />
      <Button type="submit" size="icon" disabled={disabled} aria-label="Send message" data-testid="send-message">
        <Send className="h-4 w-4" />
      </Button>
      {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
    </form>
  );
}

export function ConversationPanel({
  conversation, channel, connection, boundAgent, messages, messagesPending,
  messagesError, onRetryMessages, hasOlder, loadingOlder, onLoadOlder,
  canSend, onSent, executionEnabled, canControlExecution, conversationsKey,
  syncDegraded
}: {
  conversation: InboxConversationRecord;
  channel?: InboxChannelRecord;
  connection?: InboxConnectionRecord;
  boundAgent?: InboxAgentRecord;
  messages: InboxMessageRecord[];
  messagesPending: boolean;
  messagesError: unknown;
  onRetryMessages: () => void;
  hasOlder: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  canSend: boolean;
  onSent?: () => void;
  /** Canonical conversation-level Responix execution state from the server. */
  executionEnabled: boolean;
  canControlExecution: boolean;
  conversationsKey: readonly unknown[];
  /** The periodic message sync is failing; last known messages are still shown. */
  syncDegraded?: boolean;
}) {
  const [profileOpen, setProfileOpen] = useState(false);

  // The panel outlives a conversation switch, so reset the drawer when the
  // user selects a different conversation.
  useEffect(() => {
    setProfileOpen(false);
  }, [conversation.id]);

  useEffect(() => {
    if (!profileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [profileOpen]);

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="conversation-panel">
      <ConversationHeader
        conversation={conversation}
        channel={channel}
        executionEnabled={executionEnabled}
        onOpenProfile={() => setProfileOpen(true)}
      />
      {profileOpen && (
        <ConversationProfile
          conversation={conversation}
          channel={channel}
          connection={connection}
          boundAgent={boundAgent}
          executionEnabled={executionEnabled}
          canControlExecution={canControlExecution}
          conversationsKey={conversationsKey}
          onClose={() => setProfileOpen(false)}
        />
      )}
      {syncDegraded && (
        <p className="border-b border-border bg-secondary/40 px-4 py-1.5 text-xs text-muted-foreground" data-testid="message-sync-status">
          Live sync temporarily unavailable — showing the last synced messages.
        </p>
      )}
      {messagesPending ? (
        <p className="text-sm text-muted-foreground">Loading messages…</p>
      ) : messagesError ? (
        <ErrorFallback
          title="Messages unavailable"
          description="The conversation history could not be loaded."
          onRetry={onRetryMessages}
        />
      ) : (
        <MessageList
          messages={messages}
          conversationKey={conversation.id}
          hasOlder={hasOlder}
          loadingOlder={loadingOlder}
          onLoadOlder={onLoadOlder}
        />
      )}
      <SendBox
        channelId={conversation.channelId}
        connection={connection}
        recipient={conversation.externalConversationId}
        canSend={canSend}
        onSent={onSent}
      />
    </div>
  );
}
