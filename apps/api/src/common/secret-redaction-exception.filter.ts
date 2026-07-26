import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { redactSecrets } from "./secret-redaction";

@Catch()
export class SecretRedactionExceptionFilter implements ExceptionFilter {
  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<unknown>();
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const body =
      exception instanceof HttpException
        ? this.httpExceptionBody(exception, statusCode)
        : {
            statusCode,
            message: "Internal server error"
          };

    this.adapterHost.httpAdapter.reply(response, redactSecrets(body), statusCode);
  }

  private httpExceptionBody(exception: HttpException, statusCode: number): unknown {
    const response = exception.getResponse();
    return typeof response === "string"
      ? {
          statusCode,
          message: response
        }
      : response;
  }
}
