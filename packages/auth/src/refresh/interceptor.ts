import { apiClient } from "@responix/api-client";
import type { ApiRequestContext, ApiResponseContext } from "@responix/api-client";
import { getAccessToken, isAccessTokenExpiring } from "../session";
import { silentRefreshManager } from "./refresh-manager";

const PUBLIC_AUTH_PATHS = [
  "/api/v1/auth/login",
  "/api/v1/auth/select-workspace",
  "/api/v1/auth/refresh"
] as const;

function isPublicAuthPath(path: string): boolean {
  return PUBLIC_AUTH_PATHS.some((candidate) => path.includes(candidate));
}

export async function authRequestInterceptor(
  context: ApiRequestContext
): Promise<ApiRequestContext> {
  const config = { ...context.config, credentials: "include" as const };
  if (isPublicAuthPath(context.path)) return { ...context, config };

  if (isAccessTokenExpiring()) await silentRefreshManager.refresh();
  const token = getAccessToken();
  if (!token) return { ...context, config };
  const headers = new Headers(config.headers);
  headers.set("authorization", `Bearer ${token}`);
  return { ...context, config: { ...config, headers } };
}

export async function authResponseInterceptor({
  request,
  response,
  replay
}: ApiResponseContext): Promise<Response | void> {
  if (response.status !== 401 || request.attempt > 0 || isPublicAuthPath(request.path)) return;
  const session = await silentRefreshManager.refresh();
  return replay({ headers: { authorization: `Bearer ${session.accessToken}` } });
}

export function installAuthInterceptors(): () => void {
  const removeRequest = apiClient.addRequestInterceptor(authRequestInterceptor);
  const removeResponse = apiClient.addResponseInterceptor(authResponseInterceptor);
  return () => {
    removeResponse();
    removeRequest();
  };
}
