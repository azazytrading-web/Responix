"use client";

import { useState, type FormEvent } from "react";
import { ApiError } from "@responix/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorFallback,
  Input,
  Label,
  PageSkeleton
} from "@responix/ui";
import { Users } from "lucide-react";
import { usePlatformBootstrap } from "../../platform";
import {
  inviteTeamMember,
  listTeamMembers,
  listTeamRoles,
  removeTeamMember,
  restoreTeamMember,
  revokeTeamInvitation,
  suspendTeamMember,
  updateTeamMemberRole,
  type TeamMembership
} from "./team-api";

const PAGE_SIZE = 25;

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "The team operation could not be completed.";
}

export function TeamManagementPage() {
  const platform = usePlatformBootstrap();
  const queryClient = useQueryClient();
  const workspaceId = platform.snapshot?.workspace.id;
  const canRead = platform.hasPermission("workspace.members.read");
  const canManage = platform.hasPermission("workspace.members.manage");
  const canReadRoles = platform.hasPermission("platform.configure");
  const [page, setPage] = useState(1);
  const [userId, setUserId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [operationError, setOperationError] = useState("");
  const [invitationToken, setInvitationToken] = useState("");
  const membersKey = ["workspace", workspaceId, "members", page, PAGE_SIZE] as const;
  const members = useQuery({
    queryKey: membersKey,
    queryFn: () => listTeamMembers(page, PAGE_SIZE),
    enabled: platform.state === "READY" && Boolean(workspaceId) && canRead
  });
  const roles = useQuery({
    queryKey: ["workspace", workspaceId, "roles"],
    queryFn: listTeamRoles,
    enabled: platform.state === "READY" && Boolean(workspaceId) && canManage && canReadRoles
  });
  const refreshMembers = async () => {
    await queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId, "members"] });
  };
  const invite = useMutation({
    mutationFn: ({ targetUserId, targetRoleId }: { targetUserId: string; targetRoleId: string }) =>
      inviteTeamMember(targetUserId, targetRoleId),
    onSuccess: async (result) => {
      setInvitationToken(result.invitationToken);
      setUserId("");
      setRoleId("");
      await refreshMembers();
    }
  });
  const memberAction = useMutation({
    mutationFn: async ({ member, action, nextRoleId }: {
      member: TeamMembership;
      action: "role" | "suspend" | "restore" | "remove" | "revoke";
      nextRoleId?: string;
    }) => {
      if (action === "role" && nextRoleId) return updateTeamMemberRole(member.id, nextRoleId);
      if (action === "suspend") return suspendTeamMember(member.id);
      if (action === "restore") return restoreTeamMember(member.id);
      if (action === "revoke") return revokeTeamInvitation(member.id);
      return removeTeamMember(member.id);
    },
    onSuccess: refreshMembers
  });

  if (platform.state === "IDLE" || platform.state === "LOADING") return <PageSkeleton rows={5} />;
  if (platform.state === "ERROR" || !platform.snapshot) {
    return <ErrorFallback title="Team unavailable" description="The workspace platform state could not be loaded." onRetry={platform.retry} />;
  }
  if (!canRead) {
    return <ErrorFallback title="Access denied" description="The workspace.members.read permission is required to view team members." code="workspace.members.read" />;
  }
  if (members.isPending) return <PageSkeleton rows={5} />;
  if (members.isError || !members.data) {
    return <ErrorFallback title="Team unavailable" description="Workspace members could not be loaded." onRetry={() => { void members.refetch(); }} />;
  }

  const runAction = async (
    member: TeamMembership,
    action: "role" | "suspend" | "restore" | "remove" | "revoke",
    nextRoleId?: string
  ) => {
    setOperationError("");
    try {
      await memberAction.mutateAsync({ member, action, nextRoleId });
    } catch (error) {
      setOperationError(errorMessage(error));
    }
  };

  const submitInvitation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setOperationError("");
    setInvitationToken("");
    if (!userId || !roleId) {
      setOperationError("User ID and role are required.");
      return;
    }
    try {
      await invite.mutateAsync({ targetUserId: userId, targetRoleId: roleId });
    } catch (error) {
      setOperationError(errorMessage(error));
    }
  };

  const roleOptions = roles.data ?? [];
  const actionPending = invite.isPending || memberAction.isPending;

  return (
    <section className="space-y-6 p-6" data-testid="team-management">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground">Manage members and access for the current workspace.</p>
      </div>

      {canManage && canReadRoles && (
        <Card>
          <CardHeader>
            <CardTitle>Invite an existing user</CardTitle>
            <CardDescription>Create a workspace invitation using an existing user ID and available role.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-[1fr_1fr_auto]" onSubmit={(event) => { void submitInvitation(event); }}>
              <div className="space-y-2">
                <Label htmlFor="team-user-id">User ID</Label>
                <Input id="team-user-id" value={userId} onChange={(event) => setUserId(event.target.value)} disabled={actionPending} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-role-id">Role</Label>
                <select id="team-role-id" value={roleId} onChange={(event) => setRoleId(event.target.value)} disabled={actionPending || roles.isPending} required className="h-9 rounded-md border border-border bg-background px-3 text-sm">
                  <option value="">Select a role</option>
                  {roleOptions.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                </select>
              </div>
              <Button type="submit" className="self-end" disabled={actionPending || roles.isPending || roleOptions.length === 0}>Invite member</Button>
            </form>
            {roles.isError && <p role="alert" className="mt-3 text-sm text-destructive">Roles could not be loaded.</p>}
            {invitationToken && <p className="mt-3 break-all text-sm"><strong>Invitation token:</strong> {invitationToken}</p>}
          </CardContent>
        </Card>
      )}

      {canManage && !canReadRoles && (
        <Card><CardContent className="pt-6 text-sm text-muted-foreground">Member lifecycle actions are available. Invitation and role assignment also require platform.configure to list valid roles.</CardContent></Card>
      )}
      {operationError && <p role="alert" className="text-sm text-destructive">{operationError}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Workspace members</CardTitle>
          <CardDescription>{members.data.pagination.total} total members</CardDescription>
        </CardHeader>
        <CardContent>
          {members.data.data.length === 0 ? (
            <EmptyState title="No workspace members" description="No memberships are available in this workspace." icon={<Users className="h-5 w-5" />} />
          ) : (
            <div className="space-y-3">
              {members.data.data.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  canManage={canManage}
                  canAssignRole={canReadRoles}
                  roles={roleOptions}
                  disabled={actionPending}
                  onAction={(target, action, nextRoleId) => runAction(target, action, nextRoleId)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {members.data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page} of {members.data.pagination.totalPages}</span>
          <Button type="button" variant="outline" disabled={page >= members.data.pagination.totalPages} onClick={() => setPage((current) => current + 1)}>Next</Button>
        </div>
      )}
    </section>
  );
}

function MemberRow({ member, canManage, canAssignRole, roles, disabled, onAction }: {
  member: TeamMembership;
  canManage: boolean;
  canAssignRole: boolean;
  roles: { id: string; name: string }[];
  disabled: boolean;
  onAction: (member: TeamMembership, action: "role" | "suspend" | "restore" | "remove" | "revoke", roleId?: string) => Promise<void>;
}) {
  const pending = member.status === "INVITED" || member.status === "PENDING";
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{member.user?.fullName ?? member.userId}</p>
        <p className="truncate text-sm text-muted-foreground">{member.user?.email ?? "User details unavailable"}</p>
      </div>
      <Badge variant={member.status === "ACTIVE" ? "default" : "secondary"}>{member.status}</Badge>
      <span className="text-sm text-muted-foreground">{member.role?.name ?? "No role"}</span>
      {canManage && (
        <div className="flex flex-wrap gap-2">
          {canAssignRole && !pending && (
            <select aria-label={`Role for ${member.user?.fullName ?? member.userId}`} value={member.roleId} disabled={disabled} onChange={(event) => { void onAction(member, "role", event.target.value); }} className="h-9 rounded-md border border-border bg-background px-2 text-sm">
              {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
          )}
          {pending ? (
            <Button type="button" variant="outline" disabled={disabled} onClick={() => { void onAction(member, "revoke"); }}>Cancel invitation</Button>
          ) : member.status === "SUSPENDED" ? (
            <Button type="button" variant="outline" disabled={disabled} onClick={() => { void onAction(member, "restore"); }}>Restore</Button>
          ) : (
            <Button type="button" variant="outline" disabled={disabled} onClick={() => { void onAction(member, "suspend"); }}>Suspend</Button>
          )}
          {!pending && <Button type="button" variant="destructive" disabled={disabled} onClick={() => { void onAction(member, "remove"); }}>Remove</Button>}
        </div>
      )}
    </div>
  );
}
