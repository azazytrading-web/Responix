import { ArgumentsHost, Catch, HttpStatus } from "@nestjs/common";
import type { ExceptionFilter } from "@nestjs/common";
import { AiContractError } from "./contracts";
import { redactSecrets } from "../../common/secret-redaction";

interface HttpResponse {
  status(code: number): { json(body: unknown): unknown };
}

const statusByCode: Record<AiContractError["code"], HttpStatus> = {
  AUTHENTICATION_FAILED: HttpStatus.SERVICE_UNAVAILABLE,
  AUTHORIZATION_FAILED: HttpStatus.FORBIDDEN,
  CAPABILITY_UNAVAILABLE: HttpStatus.UNPROCESSABLE_ENTITY,
  CANCELLED: HttpStatus.REQUEST_TIMEOUT,
  CONTEXT_LIMIT_EXCEEDED: HttpStatus.BAD_REQUEST,
  CREDENTIAL_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  INVALID_REQUEST: HttpStatus.BAD_REQUEST,
  PROVIDER_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  RATE_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
  RESPONSE_INVALID: HttpStatus.BAD_GATEWAY,
  SAFETY_BLOCKED: HttpStatus.FORBIDDEN,
  TOOL_REJECTED: HttpStatus.FORBIDDEN,
  UNKNOWN: HttpStatus.INTERNAL_SERVER_ERROR
};

@Catch(AiContractError)
export class AiHttpExceptionFilter implements ExceptionFilter<AiContractError> {
  catch(exception: AiContractError, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<{ id: string }>();
    const response = http.getResponse<HttpResponse>();
    const statusCode = statusByCode[exception.code];

    response.status(statusCode).json(
      redactSecrets({
        statusCode,
        code: exception.code,
        message: exception.message,
        requestId: request.id
      })
    );
  }
}
