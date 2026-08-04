export interface AuthClaims {
  sub: string;
  workspaceId: string;
  membershipId: string;
  sessionId: string;
}

export interface WorkspaceSelectionClaims {
  sub: string;
  purpose: "workspace-selection";
  membershipIds: string[];
}
