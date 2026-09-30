import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from "@nestjs/common";
import { Prisma } from "@oic/database";

type SafeRequest = { path?: string; url?: string; requestId?: string };
type SafeResponse = {
  status(code: number): SafeResponse;
  json(body: unknown): void;
};

@Catch()
export class OicExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<SafeRequest>();
    const response = context.getResponse<SafeResponse>();
    const databaseCode = exception instanceof Prisma.PrismaClientKnownRequestError ? exception.code : undefined;
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : databaseCode === "P2002" ? HttpStatus.CONFLICT
        : databaseCode === "P2025" ? HttpStatus.NOT_FOUND
          : HttpStatus.INTERNAL_SERVER_ERROR;
    const safeError = status >= 500
      ? { code: "INTERNAL_ERROR", message: "Internal server error" }
      : status === 409 ? { code: "CONFLICT", message: "Request conflicts with existing state" }
        : status === 404 ? { code: "NOT_FOUND", message: "Resource was not found" }
          : { code: "REQUEST_ERROR", message: "Request could not be processed" };
    response.status(status).json({
      statusCode: status,
      error: safeError.code,
      message: safeError.message,
      path: request.path ?? request.url ?? "/",
      requestId: request.requestId
    });
  }
}