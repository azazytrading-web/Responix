import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { IsString } from "class-validator";
import {
  REDACTED_VALUE,
  redactLogArguments,
  redactSecretText,
  redactSecrets
} from "./secret-redaction";
import { SecretRedactionExceptionFilter } from "./secret-redaction-exception.filter";

const CANARY = "FORTRESS_SECRET_CANARY_7d245afc";

class CanaryValidationDto {
  @IsString()
  name!: string;
}

function serialized(value: unknown): string {
  return JSON.stringify(value);
}

describe("secret redaction fortress", () => {
  it("redacts protected fields recursively without mutating safe values", () => {
    const input = {
      event: "security.test",
      authorization: `Bearer ${CANARY}`,
      nested: {
        passwordHash: CANARY,
        array: [{ clientSecret: CANARY }],
        safe: "visible"
      }
    };

    const output = redactSecrets(input);

    expect(serialized(output)).not.toContain(CANARY);
    expect(output).toMatchObject({
      event: "security.test",
      authorization: REDACTED_VALUE,
      nested: {
        passwordHash: REDACTED_VALUE,
        array: [{ clientSecret: REDACTED_VALUE }],
        safe: "visible"
      }
    });
    expect(input.nested.passwordHash).toBe(CANARY);
  });

  it("removes secret canaries from logger arguments and error objects", () => {
    const output = redactLogArguments([
      {
        event: "provider.failed",
        provider: { encryptedSecret: CANARY }
      },
      Object.assign(new Error(`secret=${CANARY}`), {
        apiKey: CANARY
      })
    ]);

    expect(serialized(output)).not.toContain(CANARY);
    expect(serialized(output)).toContain(REDACTED_VALUE);
  });

  it("redacts bearer tokens, JWTs, connection URLs, and named text assignments", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature";
    const output = redactSecretText(
      `Bearer ${CANARY} jwt=${jwt} databaseUrl=postgresql://user:${CANARY}@db/responix`
    );

    expect(output).not.toContain(CANARY);
    expect(output).not.toContain(jwt);
    expect(output).toContain(REDACTED_VALUE);
  });

  it("removes secret canaries from HTTP exception responses", () => {
    const reply = jest.fn();
    const filter = new SecretRedactionExceptionFilter({
      httpAdapter: { reply }
    } as never);
    const response = {};
    const host = {
      switchToHttp: () => ({
        getResponse: () => response
      })
    };

    filter.catch(
      new BadRequestException({
        statusCode: 400,
        message: `password=${CANARY}`,
        nested: { refreshToken: CANARY }
      }),
      host as never
    );

    expect(reply).toHaveBeenCalledWith(response, expect.any(Object), 400);
    const calls = reply.mock.calls as unknown[][];
    expect(serialized(calls[0]?.[1])).not.toContain(CANARY);
  });

  it("does not echo secret canaries in validation failures", async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validationError: { target: false, value: false }
    });

    let failure: unknown;
    try {
      await pipe.transform(
        { name: 123, password: CANARY },
        { type: "body", metatype: CanaryValidationDto }
      );
    } catch (error: unknown) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(BadRequestException);
    expect(serialized((failure as BadRequestException).getResponse())).not.toContain(CANARY);
  });
});
