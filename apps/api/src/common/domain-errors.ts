import { HttpException, HttpStatus } from "@nestjs/common";

class DomainException extends HttpException {
  constructor(status: HttpStatus, code: string, message: string) {
    super({ statusCode: status, code, message }, status);
  }
}

export class DuplicateMembershipException extends DomainException {
  constructor() {
    super(HttpStatus.CONFLICT, "DUPLICATE_MEMBERSHIP", "User already has a workspace membership");
  }
}

export class DuplicateWorkspaceException extends DomainException {
  constructor() {
    super(HttpStatus.CONFLICT, "DUPLICATE_WORKSPACE", "Workspace slug already exists");
  }
}

export class InvalidMembershipTransitionException extends DomainException {
  constructor() {
    super(
      HttpStatus.CONFLICT,
      "INVALID_MEMBERSHIP_TRANSITION",
      "Invalid membership status transition"
    );
  }
}

export class WorkspaceInactiveException extends DomainException {
  constructor() {
    super(HttpStatus.CONFLICT, "WORKSPACE_INACTIVE", "Workspace is not active");
  }
}

export class WorkspaceNotFoundException extends DomainException {
  constructor() {
    super(HttpStatus.NOT_FOUND, "INVALID_WORKSPACE", "Workspace not found");
  }
}

export class WorkspaceQuotaExceededException extends DomainException {
  constructor() {
    super(HttpStatus.CONFLICT, "WORKSPACE_QUOTA_EXCEEDED", "Workspace user quota has been reached");
  }
}

export class InvalidInvitationException extends DomainException {
  constructor() {
    super(HttpStatus.FORBIDDEN, "INVALID_INVITATION", "Invitation is invalid or expired");
  }
}

export class LastOwnerException extends DomainException {
  constructor() {
    super(
      HttpStatus.CONFLICT,
      "LAST_ACTIVE_OWNER",
      "The last active workspace owner cannot be changed"
    );
  }
}

export class PermissionDeniedException extends DomainException {
  constructor() {
    super(
      HttpStatus.FORBIDDEN,
      "PERMISSION_DENIED",
      "You do not have permission to perform this action"
    );
  }
}

export class InvalidRoleException extends DomainException {
  constructor() {
    super(HttpStatus.BAD_REQUEST, "INVALID_ROLE", "Role is not available in this workspace");
  }
}

export class MembershipInactiveException extends DomainException {
  constructor() {
    super(
      HttpStatus.FORBIDDEN,
      "MEMBERSHIP_INACTIVE",
      "An active workspace membership is required"
    );
  }
}
