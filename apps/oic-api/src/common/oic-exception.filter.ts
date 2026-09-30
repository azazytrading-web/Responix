import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { Prisma } from "@oic/database";
import type { OicRuntimeErrorCode } from "@oic/contracts";
import { OicRuntimeException, runtimeErrorMessage } from "../modules/runtime-plane/runtime-errors";

type SafeRequest = { path?: string; url?: string; requestId?: string; headers?: Record<string, string | string[] | undefined> };
type SafeResponse = { status(code: number): SafeResponse; json(body: unknown): void };

function firstHeader(headers: SafeRequest["headers"], name: string): string | undefined {
  const value = headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}
function correlationValue(value: string | undefined): string | undefined {
  return value && value.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(value) ? value : undefined;
}
function mappedCode(status: number): OicRuntimeErrorCode {
  if (status === 401) return "AUTHENTICATION_FAILED";
  if (status === 403) return "AUTHORIZATION_DENIED";
  if (status === 404) return "MODEL_NOT_FOUND";
  if (status === 409) return "IDEMPOTENCY_CONFLICT";
  if (status === 413 || status === 400 || status === 422) return "INVALID_REQUEST";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "RUNTIME_UNAVAILABLE";
  return "INVALID_REQUEST";
}

@Catch()
export class OicExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<SafeRequest>();
    const response = context.getResponse<SafeResponse>();
    const path = request.path ?? request.url ?? "/";
    const runtimeRoute = path.startsWith("/api/v1/runtime/");
    const compatibilityRoute = path.startsWith("/v1/");
    const databaseCode = exception instanceof Prisma.PrismaClientKnownRequestError ? exception.code : undefined;
    const parserStatus = typeof exception === "object" && exception !== null && "status" in exception && typeof exception.status === "number" ? exception.status : undefined;
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : parserStatus ?? (databaseCode === "P2002" ? HttpStatus.CONFLICT : databaseCode === "P2025" ? HttpStatus.NOT_FOUND : HttpStatus.INTERNAL_SERVER_ERROR);
    const requestId = correlationValue(request.requestId);
    const traceId = correlationValue(firstHeader(request.headers, "x-trace-id") ?? firstHeader(request.headers, "x-correlation-id"));

    if (runtimeRoute || compatibilityRoute) {
      const code = exception instanceof OicRuntimeException ? exception.code : mappedCode(status);
      const message = runtimeErrorMessage(code);
      if (compatibilityRoute) {
        response.status(status).json({ error: { code, message, type: "oic_error", request_id: requestId } });
      } else {
        response.status(status).json({ error: { code, message, requestId, traceId } });
      }
      return;
    }

    const safeError = status >= 500
      ? { code: "INTERNAL_ERROR", message: "Internal server error" }
      : status === 409 ? { code: "CONFLICT", message: "Request conflicts with existing state" }
        : status === 404 ? { code: "NOT_FOUND", message: "Resource was not found" }
          : { code: "REQUEST_ERROR", message: "Request could not be processed" };
    response.status(status).json({ statusCode: status, error: safeError.code, message: safeError.message, path, requestId });
  }
}
