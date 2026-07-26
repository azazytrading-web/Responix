export interface SafeUser {
  id: string;
  workspaceId: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  roleId: string | null;
  departmentId: string | null;
  status: string;
  language: string;
  timezone: string;
  lastLoginAt: Date | null;
  emailVerified: boolean;
  mfaEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SafeRole {
  id: string;
  workspaceId: string | null;
  name: string;
  description: string | null;
  priority: number;
  systemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SafeMembership {
  id: string;
  workspaceId: string;
  userId: string;
  roleId: string;
  status: string;
  invitedAt: Date;
  acceptedAt: Date | null;
  suspendedAt: Date | null;
  removedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user?: SafeUser;
  role?: SafeRole;
}

export interface SafeInvitation {
  id: string;
  workspaceId: string;
  membershipId: string;
  targetUserId: string;
  invitedByUserId: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  rejectedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  membership?: SafeMembership;
  workspace?: {
    status: string;
    isDeleted: boolean;
  };
}
