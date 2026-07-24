import { createParamDecorator } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<{ user?: unknown }>().user
);
export const CurrentWorkspace = createParamDecorator(
  (_: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<{ user?: { workspaceId?: string } }>().user?.workspaceId
);
