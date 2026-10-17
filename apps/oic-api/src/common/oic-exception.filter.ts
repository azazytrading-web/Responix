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

    if (path === "/api/v1/admin/evaluations/runs" && status === 409 && exception instanceof HttpException) {
      const detail = exception.getResponse();
      const message = typeof detail === "string" ? detail : detail && typeof detail === "object" && "message" in detail ? detail.message : undefined;
      const reasonCode = typeof message === "string" && /^[A-Z][A-Z0-9_]{1,95}$/.test(message) ? message : "RUN_START_CONFLICT";
      process.stderr.write(`${JSON.stringify({ event: "evaluation.run.start_blocked", requestId, reasonCode })}\n`);
    }

    if (path === "/api/v1/admin/evaluations/packet76/accounting/reconcile" && status === 409 && exception instanceof HttpException) {
      const detail = exception.getResponse();
      const message = typeof detail === "string" ? detail : detail && typeof detail === "object" && "message" in detail ? detail.message : undefined;
      const reasonCode = typeof message === "string" && /^[A-Z][A-Z0-9_]{1,95}$/.test(message) ? message : "ACCOUNTING_RECONCILIATION_CONFLICT";
      process.stderr.write(`${JSON.stringify({ event: "evaluation.packet76.accounting_reconciliation_blocked", requestId, reasonCode })}\n`);
    }

    if (path.startsWith("/api/v1/admin/evaluations/") && status >= 500) {
      const exceptionClass = exception instanceof Error ? exception.constructor.name : "UnknownError";
      const nested = typeof exception === "object" && exception !== null && "cause" in exception ? exception.cause : undefined;
      const nestedClass = nested instanceof Error ? nested.constructor.name : undefined;
      const nestedCode = typeof nested === "object" && nested !== null && "code" in nested && typeof nested.code === "string" && /^[A-Z0-9_]{2,32}$/.test(nested.code) ? nested.code : undefined;
      const exceptionCode = typeof exception === "object" && exception !== null && "code" in exception && typeof exception.code === "string" && /^[A-Z0-9_]{2,32}$/.test(exception.code) ? exception.code : undefined;
      const safeMessage = exception instanceof Error ? exception.message : "";
      const sqlState = /Code:\s*([A-Z0-9]{5})/.exec(safeMessage)?.[1] ?? null;
      const safeDatabaseCause = /OicEvaluationRun_budget_released_check/i.test(safeMessage) ? "BUDGET_RELEASE_CHECK"
        : /deadlock detected/i.test(safeMessage) ? "DATABASE_DEADLOCK"
          : /canceling statement due to statement timeout/i.test(safeMessage) ? "DATABASE_STATEMENT_TIMEOUT"
            : /could not serialize access/i.test(safeMessage) ? "DATABASE_SERIALIZATION_CONFLICT"
              : /raw query failed/i.test(safeMessage) ? "RAW_QUERY_FAILED"
                : /transaction api error/i.test(safeMessage) ? "TRANSACTION_API_ERROR"
                  : /transaction already closed/i.test(safeMessage) ? "TRANSACTION_CLOSED"
                    : /column .* does not exist/i.test(safeMessage) ? "DATABASE_COLUMN_MISSING"
                      : /relation .* does not exist/i.test(safeMessage) ? "DATABASE_RELATION_MISSING"
                        : /error occurred during query execution/i.test(safeMessage) ? "QUERY_EXECUTION_ERROR" : undefined;
      const safeFrame = exception instanceof Error ? exception.stack?.split("\n").slice(1).find((line) => /apps[\\/]oic-api[\\/](src|dist)[\\/]/.test(line))?.trim().slice(0, 240) : undefined;
      process.stderr.write(`${JSON.stringify({ event: "evaluation.admin.request_failed", requestId, status, exceptionClass, exceptionCode, databaseCode, nestedClass, nestedCode, ...(path === "/api/v1/admin/evaluations/packet76/accounting/reconcile" ? { sqlState, safeDatabaseCause, safeFrame } : {}) })}\n`);
    }

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

    if (path.startsWith("/api/v1/reviewer/domain-content-assignments")) {
      const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : undefined;
      const responseMessage = typeof exceptionResponse === "string"
        ? exceptionResponse
        : exceptionResponse && typeof exceptionResponse === "object" && "message" in exceptionResponse
          ? (exceptionResponse as { message?: unknown }).message
          : undefined;
      const safeMessage = typeof responseMessage === "string" ? responseMessage : Array.isArray(responseMessage) ? responseMessage.join(" ") : "";
      const code = status === 401 ? "REVIEWER_SESSION_EXPIRED"
        : status === 403 ? "REVIEW_NOT_AUTHORIZED"
          : status === 404 ? safeMessage.includes("ASSIGNMENT_STATE_CHANGED") ? "ASSIGNMENT_STATE_CHANGED" : "ASSIGNMENT_NOT_FOUND"
            : status === 409 && ["ASSIGNMENT_ALREADY_SUBMITTED", "ASSIGNMENT_STATE_CHANGED"].includes(safeMessage) ? safeMessage
              : status === 409 ? "ASSIGNMENT_STATE_CHANGED"
                : status === 400 || status === 422 ? "INVALID_REVIEW_SUBMISSION"
                  : status >= 500 ? "INTERNAL_REVIEW_ERROR" : "REVIEW_REQUEST_FAILED";
      const message = code === "REVIEWER_SESSION_EXPIRED" ? "Reviewer session expired"
        : code === "REVIEW_NOT_AUTHORIZED" ? "Review is not authorized"
          : code === "ASSIGNMENT_NOT_FOUND" ? "Assignment was not found"
            : code === "ASSIGNMENT_ALREADY_SUBMITTED" ? "Assignment was already submitted"
              : code === "ASSIGNMENT_STATE_CHANGED" ? "Assignment state changed; refresh before continuing"
                : code === "INVALID_REVIEW_SUBMISSION" ? "Review submission is invalid"
                  : code === "INTERNAL_REVIEW_ERROR" ? "Review could not be processed" : "Review request could not be processed";
      const exceptionClass = exception instanceof Error ? exception.constructor.name : "UnknownError";
      process.stderr.write(`${JSON.stringify({ event: "reviewer.domain_review.request_failed", requestId, status, code, exceptionClass, databaseCode })}\n`);
      response.status(status).json({ statusCode: status, error: { code, message }, requestId });
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
