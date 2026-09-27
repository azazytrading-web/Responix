"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError } from "@responix/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ErrorFallback,
  Input,
  Label,
  PageSkeleton,
  Textarea
} from "@responix/ui";
import { usePlatformBootstrap } from "../../platform";
import { createSpace, listSpaces, updateSpace, type KnowledgeSpace } from "./knowledge-api";

function errorText(error: unknown): string {
  return error instanceof ApiError || error instanceof Error ? error.message || "The knowledge space could not be saved." : "The knowledge space could not be saved.";
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160);
}

export function KnowledgeBaseSpaceFormPage({ spaceId }: { spaceId?: string }) {
  const platform = usePlatformBootstrap();
  const router = useRouter();
  const queryClient = useQueryClient();
  const workspaceId = platform.snapshot?.workspace.id;
  const canRead = platform.hasPermission("knowledge.base.read");
  const canManage = platform.hasPermission("knowledge.base.manage");

  const spaces = useQuery({
    queryKey: ["workspace", workspaceId, "knowledge", "spaces"],
    queryFn: () => listSpaces(),
    enabled: platform.state === "READY" && Boolean(workspaceId) && canRead
  });
  const space: KnowledgeSpace | undefined = spaceId ? spaces.data?.find((item) => item.id === spaceId) : undefined;

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [failure, setFailure] = useState("");
  const [notice, setNotice] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && space) {
      setName(space.name);
      setSlug(space.slug);
      setDescription(space.description ?? "");
      setInitialized(true);
    }
  }, [space, initialized]);

  const save = useMutation({
    mutationFn: () =>
      spaceId
        ? updateSpace(spaceId, { name: name.trim(), description })
        : createSpace({ name: name.trim(), slug: slugify(slugTouched ? slug : name), description }),
    onSuccess: async () => {
      setNotice(spaceId ? "Knowledge space updated." : "Knowledge space created.");
      await queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId, "knowledge"] });
      router.push("/knowledge");
    }
  });
  const busy = save.isPending;


  if (platform.state === "IDLE" || platform.state === "LOADING") return <PageSkeleton rows={4} />;
  if (platform.state === "ERROR" || !platform.snapshot) {
    return <ErrorFallback title="Knowledge Base unavailable" description="The workspace platform state could not be loaded." onRetry={platform.retry} />;
  }
  if (!canRead) {
    return <ErrorFallback title="Access denied" description="The knowledge.base.read permission is required to manage knowledge spaces." code="knowledge.base.read" />;
  }
  if (spaces.isPending) return <PageSkeleton rows={4} />;
  if (spaces.isError || !spaces.data) {
    return <ErrorFallback title="Knowledge Base unavailable" description="Workspace knowledge spaces could not be loaded." onRetry={() => { void spaces.refetch(); }} />;
  }
  if (spaceId && !space) {
    return <ErrorFallback title="Space not found" description="The knowledge space does not exist in this workspace." onRetry={() => { void spaces.refetch(); }} />;
  }

  const valid = name.trim().length > 0 && (spaceId || slugify(slugTouched ? slug : name).length > 0);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage || busy || !valid) return;
    setFailure("");
    setNotice("");
    try {
      await save.mutateAsync();
    } catch (error) {
      setFailure(errorText(error));
    }
  };

  return (
    <section className="space-y-6 p-6" data-testid="knowledge-base-form">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{spaceId ? "Edit knowledge space" : "Create knowledge space"}</h1>
          <p className="text-sm text-muted-foreground">Knowledge spaces group the workspace documents that agents can retrieve.</p>
        </div>
        <Link href="/knowledge" className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent">
          Back to list
        </Link>
      </div>

      <form onSubmit={(event) => { void submit(event); }} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Space details</CardTitle>
            <CardDescription>The name is required. The slug is generated from the name and used as a stable identifier.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="space-name">Name</Label>
              <Input id="space-name" value={name} maxLength={160} disabled={busy || !canManage} placeholder="Support articles" onChange={(event) => { setName(event.target.value); if (!slugTouched) setSlug(slugify(event.target.value)); }} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="space-slug">Slug</Label>
              <Input id="space-slug" value={slug} maxLength={160} disabled={Boolean(spaceId) || busy || !canManage} placeholder="support-articles" onChange={(event) => { setSlugTouched(true); setSlug(event.target.value); }} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="space-description">Description</Label>
              <Textarea id="space-description" value={description} maxLength={2000} rows={4} disabled={busy || !canManage} placeholder="What this knowledge space contains" onChange={(event) => setDescription(event.target.value)} />
            </div>
          </CardContent>
        </Card>

        {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
        {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!canManage || busy || !valid}>
            {busy ? "Saving…" : spaceId ? "Save changes" : "Create space"}
          </Button>
          <Link href="/knowledge" className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent">Cancel</Link>
        </div>
      </form>
    </section>
  );
}
