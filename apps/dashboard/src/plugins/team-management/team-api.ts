import { apiClient } from "@responix/api-client";

export interface TeamUser {
  id: string;
  fullName: string;
  email: string;
  status: string;
}

export interface TeamRole {
  id: string;
  name: string;
  systemRole?: boolean;
}

export interface TeamMembership {
  id: string;
  userId: string;
  roleId: string;
  status: string;
  invitedAt: string;
  acceptedAt: string | null;
  user?: TeamUser;
  role?: TeamRole;
}

export interface TeamMemberPage {
  data: TeamMembership[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface TeamInvitation {
  membership: TeamMembership;
  invitationToken: string;
  expiresAt: string;
}

const cookieConfig = { credentials: "include" as const };

export function listTeamMembers(page: number, limit = 25): Promise<TeamMemberPage> {
  return apiClient.get<TeamMemberPage>("/api/v1/workspaces/current/members", {
    ...cookieConfig,
    query: { page, limit }
  });
}

export function listTeamRoles(): Promise<TeamRole[]> {
  return apiClient.get<TeamRole[]>("/api/v1/platform/permissions/roles", cookieConfig);
}

export function inviteTeamMember(userId: string, roleId: string): Promise<TeamInvitation> {
  return apiClient.post<TeamInvitation>(
    "/api/v1/workspaces/current/members",
    { userId, roleId },
    cookieConfig
  );
}

export function updateTeamMemberRole(membershipId: string, roleId: string): Promise<TeamMembership> {
  return apiClient.patch<TeamMembership>(
    `/api/v1/workspaces/current/members/${membershipId}/role`,
    { roleId },
    cookieConfig
  );
}

export function suspendTeamMember(membershipId: string): Promise<TeamMembership> {
  return apiClient.post<TeamMembership>(
    `/api/v1/workspaces/current/members/${membershipId}/suspend`,
    undefined,
    cookieConfig
  );
}

export function restoreTeamMember(membershipId: string): Promise<TeamMembership> {
  return apiClient.post<TeamMembership>(
    `/api/v1/workspaces/current/members/${membershipId}/restore`,
    undefined,
    cookieConfig
  );
}

export function removeTeamMember(membershipId: string): Promise<TeamMembership> {
  return apiClient.delete<TeamMembership>(
    `/api/v1/workspaces/current/members/${membershipId}`,
    cookieConfig
  );
}

export function revokeTeamInvitation(membershipId: string): Promise<TeamMembership> {
  return apiClient.delete<TeamMembership>(
    `/api/v1/workspaces/current/members/${membershipId}/invitation`,
    cookieConfig
  );
}
