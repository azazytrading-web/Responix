"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, ErrorFallback, PageSkeleton } from "@responix/ui";
import { MessageSquare } from "lucide-react";
import { usePlatformBootstrap } from "../../platform";
import { ConversationList, ConversationPanel } from "./components";
import {
  inboxQueryKey, listInboxAgents, listInboxChannels, listInboxConnections,
  listInboxConversations, listInboxMessages, listWorkspaceMessages,
  type InboxConversationRecord, type InboxMessageRecord
} from "./inbox-api";
import {
  countUnreadSince, mergeMessages, newestMessageTime, timestampMs
} from "./inbox-sync";
import { loadInboxReadState, saveInboxReadState } from "./inbox-read-state";

const PAGE_SIZE = 50;
const CONVERSATION_SYNC_INTERVAL_MS = 5000;
const MESSAGE_SYNC_INTERVAL_MS = 3000;

interface ConversationMessagesState {
  conversationId: string | null;
  page: number;
  totalPages: number;
  messages: InboxMessageRecord[];
  loading: boolean;
  loadingOlder: boolean;
  error: unknown;
  /** Set when a periodic background sync fails; last known messages are kept. */
  syncError: unknown;
}

const initialMessagesState: ConversationMessagesState = {
  conversationId: null,
  page: 0,
  totalPages: 0,
  messages: [],
  loading: false,
  loadingOlder: false,
  error: undefined,
  syncError: undefined
};

export function InboxPage() {
  const platform = usePlatformBootstrap();
  const workspaceId = platform.snapshot?.workspace.id;
  const canRead = platform.hasPermission("channel.runtime.read");
  const canReadConnections = platform.hasPermission("whatsapp.connection.read");
  const canSend = platform.hasPermission("channel.runtime.write");
  const canSeeAgents = platform.hasPermission("agent.studio.read");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messagesState, setMessagesState] = useState<ConversationMessagesState>(initialMessagesState);
  // Workspace-scoped unread model: the backend exposes no operator read
  // state, so each conversation's read boundary is persisted to localStorage
  // (keyed by workspace). `null` means the persisted state has not been
  // hydrated yet; only customer messages arriving after the boundary count
  // as unread. The boundary never resets on mount, navigation, refresh or
  // refetch — it only moves when the conversation is opened or new messages
  // are read while it is open.
  const [readState, setReadState] = useState<Record<string, number> | null>(null);
  const inFlightSyncRef = useRef<Set<string>>(new Set());

  const ready = platform.state === "READY" && Boolean(workspaceId) && canRead;
  const baseKey = inboxQueryKey(workspaceId);

  const channelsQuery = useQuery({
    queryKey: [...baseKey, "channels"],
    queryFn: listInboxChannels,
    enabled: ready
  });
  // Live inbox: conversations revalidate while the tab is visible
  // (react-query pauses refetchInterval for hidden tabs by default and
  // refetches on window focus via the shared query-client defaults).
  const conversationsQuery = useQuery({
    queryKey: [...baseKey, "conversations"],
    queryFn: () => listInboxConversations(),
    enabled: ready,
    refetchInterval: CONVERSATION_SYNC_INTERVAL_MS
  });
  // Bounded workspace-wide window of the newest messages; drives the
  // session-scoped unread counts without polling every conversation.
  const workspaceMessagesQuery = useQuery({
    queryKey: [...baseKey, "recent-messages"],
    queryFn: () => listWorkspaceMessages(1, 100),
    enabled: ready,
    refetchInterval: CONVERSATION_SYNC_INTERVAL_MS
  });
  const agentsQuery = useQuery({
    queryKey: [...baseKey, "agents"],
    queryFn: listInboxAgents,
    enabled: ready && canSeeAgents
  });

  const selected: InboxConversationRecord | null =
    conversationsQuery.data?.find((conversation) => conversation.id === selectedId) ?? null;
  const selectedChannel = selected
    ? channelsQuery.data?.data.find((channel) => channel.id === selected.channelId)
    : undefined;

  const connectionsQuery = useQuery({
    queryKey: [...baseKey, "connections", selected?.channelId ?? null],
    queryFn: () => listInboxConnections(selected!.channelId),
    enabled: ready && canReadConnections && Boolean(selected?.channelId)
  });
  const connection = connectionsQuery.data?.[0];

  const boundAgent =
    agentsQuery.data?.data.find((agent) =>
      agent.activeChannels.some((entry) =>
        connection
          ? entry.connectionId === connection.id
          : entry.channelId === selected?.channelId
      )
    );

  const loadMessages = useCallback(
    async (conversationId: string, page: number) => {
      setMessagesState((current) => ({
        ...current,
        conversationId,
        // Switching conversations starts from an empty list; refreshing the
        // same conversation keeps its messages and merges the new batch in.
        messages: current.conversationId === conversationId ? current.messages : [],
        loading: page === 1,
        loadingOlder: page > 1,
        error: undefined,
        syncError: undefined
      }));
      try {
        const result = await listInboxMessages(conversationId, page, PAGE_SIZE);
        setMessagesState((current) => {
          // Race guard: a slow response for a previous selection must never
          // clobber the conversation that is selected now.
          if (current.conversationId !== conversationId) return current;
          // The backend pages newest-first; merge de-duplicates by id and
          // keeps the rendered list in oldest-first order.
          const incoming = [...result.data].reverse();
          return {
            conversationId,
            page,
            totalPages: result.pagination.totalPages,
            messages: mergeMessages(current.messages, incoming),
            loading: false,
            loadingOlder: false,
            error: undefined,
            syncError: undefined
          };
        });
      } catch (error) {
        setMessagesState((current) =>
          current.conversationId === conversationId
            ? { ...current, loading: false, loadingOlder: false, error }
            : current
        );
      }
    },
    []
  );

  useEffect(() => {
    if (!selectedId) {
      setMessagesState(initialMessagesState);
      return;
    }
    void loadMessages(selectedId, 1);
  }, [selectedId, loadMessages]);

  const loadOlder = () => {
    if (!selectedId) return;
    void loadMessages(selectedId, messagesState.page + 1);
  };

  const conversationsKey = [...baseKey, "conversations"];
  const conversations = conversationsQuery.data ?? [];

  // Hydrate the persisted read boundaries once the workspace is known.
  useEffect(() => {
    if (!ready || !workspaceId || readState !== null) return;
    setReadState(loadInboxReadState(workspaceId));
  }, [ready, workspaceId, readState]);

  // Mirror every boundary change back to storage so unread counts survive
  // navigation, refresh and browser reinitialization.
  useEffect(() => {
    if (readState === null || !ready || !workspaceId) return;
    saveInboxReadState(workspaceId, readState);
  }, [readState, ready, workspaceId]);

  // Baseline the unread model: conversations are baselined the first time
  // they appear; persisted entries are never reset by refetches, so unread
  // counts survive remounts, navigation and refresh.
  useEffect(() => {
    if (conversations.length === 0 || readState === null) return;
    setReadState((current) => {
      if (current === null) return current;
      let next: Record<string, number> | null = null;
      for (const conversation of conversations) {
        if (current[conversation.id] === undefined) {
          next = next ? next : { ...current };
          next[conversation.id] = timestampMs(conversation.lastMessageAt ?? conversation.updatedAt);
        }
      }
      return next ?? current;
    });
  }, [conversations, readState]);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    // Opening a conversation marks it as read right away.
    setReadState((current) => (current === null ? current : { ...current, [id]: Date.now() }));
  }, []);

  const handledConversationHash = useRef("");
  useEffect(() => {
    if (typeof window === "undefined" || conversations.length === 0) return;
    const hash = window.location.hash;
    if (!hash.startsWith("#conversationId=") || handledConversationHash.current === hash) return;
    handledConversationHash.current = hash;
    const id = decodeURIComponent(hash.slice("#conversationId=".length));
    if (conversations.some((conversation) => conversation.id === id)) handleSelect(id);
  }, [conversations, handleSelect]);

  // While a conversation is open, messages arriving into it are visible, so
  // the read marker follows the newest message (no unread badge while open).
  const selectedMessages =
    selectedId !== null && messagesState.conversationId === selectedId
      ? messagesState.messages
      : [];
  useEffect(() => {
    if (!selectedId || selectedMessages.length === 0) return;
    const latest = newestMessageTime(selectedMessages);
    setReadState((current) => {
      if (current === null) return current;
      const existing = current[selectedId] ?? 0;
      return latest > existing ? { ...current, [selectedId]: latest } : current;
    });
  }, [selectedId, selectedMessages]);

  const unread = useMemo(() => {
    const counts: Record<string, number> = {};
    const window = workspaceMessagesQuery.data?.data ?? [];
    for (const conversation of conversations) {
      if (conversation.id === selectedId) continue;
      const lastReadAt = readState?.[conversation.id];
      if (lastReadAt === undefined) continue;
      const count = countUnreadSince(window, conversation.id, lastReadAt);
      if (count > 0) counts[conversation.id] = count;
    }
    return counts;
  }, [conversations, readState, workspaceMessagesQuery.data, selectedId]);

  // Periodic message sync for the selected conversation. Pauses while the tab
  // is hidden and syncs immediately when it becomes visible again. Failures
  // keep the last known messages and surface a subtle status only.
  useEffect(() => {
    if (!selectedId) return;
    const id = selectedId;
    const sync = () => {
      if (document.visibilityState !== "visible" || inFlightSyncRef.current.has(id)) return;
      inFlightSyncRef.current.add(id);
      listInboxMessages(id, 1, PAGE_SIZE)
        .then((result) => {
          const incoming = [...result.data].reverse();
          setMessagesState((current) =>
            current.conversationId === id
              ? { ...current, messages: mergeMessages(current.messages, incoming), syncError: undefined }
              : current
          );
        })
        .catch((error) => {
          setMessagesState((current) =>
            current.conversationId === id ? { ...current, syncError: error } : current
          );
        })
        .finally(() => {
          inFlightSyncRef.current.delete(id);
        });
    };
    const timer = setInterval(sync, MESSAGE_SYNC_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [selectedId]);

  if (platform.state === "IDLE" || platform.state === "LOADING") return <PageSkeleton rows={6} />;
  if (platform.state === "ERROR" || !platform.snapshot) {
    return <ErrorFallback title="Inbox unavailable" description="The workspace platform state could not be loaded." onRetry={platform.retry} />;
  }
  if (!canRead) {
    return <ErrorFallback title="Access denied" description="Channel Runtime read permission is required to open the inbox." code="channel.runtime.read" />;
  }

  if (channelsQuery.isPending || conversationsQuery.isPending) return <PageSkeleton rows={6} />;
  if (channelsQuery.isError || conversationsQuery.isError) {
    return (
      <ErrorFallback
        title="Inbox unavailable"
        description="Workspace channel conversations could not be loaded."
        onRetry={() => { void channelsQuery.refetch(); void conversationsQuery.refetch(); }}
      />
    );
  }

  const channels = channelsQuery.data?.data ?? [];

  const header = (
    <div className="border-b border-border px-6 py-4">
      <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
      <p className="text-sm text-muted-foreground">
        Channel conversations for this workspace. {conversations.length} conversation{conversations.length === 1 ? "" : "s"}.
      </p>
    </div>
  );

  if (channels.length === 0) {
    return (
      <section className="flex h-[calc(100dvh-56px)] min-h-0 flex-col" data-testid="inbox-page">
        {header}
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState
            title="No channels connected"
            description="Connect a channel before conversations can appear in the inbox."
            icon={<MessageSquare className="h-5 w-5" />}
            action={
              <Link
                href="/channels/whatsapp"
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Set up WhatsApp Business
              </Link>
            }
          />
        </div>
      </section>
    );
  }

  const hasOlder = messagesState.page < messagesState.totalPages;
  const messagesForSelected =
    messagesState.conversationId === selectedId ? messagesState : initialMessagesState;

  // Bounded to the application viewport (topbar is h-14 = 56px) so the inbox
  // is a fixed-height layout and the page itself never scrolls — the
  // conversation list and the message history scroll inside.
  return (
    <section className="flex h-[calc(100dvh-56px)] min-h-0 flex-col" data-testid="inbox-page">
      {header}
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          {selected ? (
            <ConversationPanel
              conversation={selected}
              channel={selectedChannel}
              connection={connection}
              boundAgent={boundAgent}
              messages={messagesForSelected.messages}
              messagesPending={messagesForSelected.loading}
              messagesError={messagesForSelected.error}
              onRetryMessages={() => { void loadMessages(selected.id, 1); }}
              hasOlder={hasOlder}
              loadingOlder={messagesForSelected.loadingOlder}
              onLoadOlder={loadOlder}
              canSend={canSend}
              onSent={() => {
                void loadMessages(selected.id, 1);
                void conversationsQuery.refetch();
              }}
              executionEnabled={selected.agentExecutionEnabled !== false}
              canControlExecution={canSend}
              conversationsKey={conversationsKey}
              syncDegraded={messagesForSelected.syncError !== undefined && !messagesForSelected.loading}
            />
          ) : (
            <EmptyState
              title="Select a conversation"
              description="Pick a conversation from the list to view its channel history."
              icon={<MessageSquare className="h-5 w-5" />}
            />
          )}
        </div>
        <div className="w-96 shrink-0 border-l border-border">
          <ConversationList
            conversations={conversations}
            channels={channels}
            selectedId={selectedId}
            unread={unread}
            syncDegraded={conversationsQuery.isError && conversations.length > 0}
            onSelect={handleSelect}
          />
        </div>
      </div>
    </section>
  );
}
