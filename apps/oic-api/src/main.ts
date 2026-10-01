import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { RequestMethod, VersioningType } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app/app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true, bodyParser: false });
  const config = app.get(ConfigService);
  app.useBodyParser("json", { limit: config.getOrThrow<number>("OIC_HTTP_MAX_BODY_BYTES"), strict: true });
  const port = config.getOrThrow<number>("OIC_PORT");
  app.enableShutdownHooks();
  app.use((request: { headers: Record<string, string | string[] | undefined>; requestId?: string; runtimeInvalidHeader?: boolean }, response: { setHeader(name: string, value: string): void }, next: () => void) => {
    const candidate = request.headers["x-request-id"];
    const supplied = Array.isArray(candidate) ? candidate[0] : candidate;
    const valid = supplied === undefined || (supplied.length <= 128 && /^[A-Za-z0-9._:-]+$/.test(supplied));
    request.runtimeInvalidHeader = !valid;
    request.requestId = valid && supplied ? supplied : randomUUID();
    response.setHeader("x-request-id", request.requestId);
    next();
  });
  app.setGlobalPrefix("api", { exclude: [
    { path: "v1/models", method: RequestMethod.GET },
    { path: "v1/chat/completions", method: RequestMethod.POST },
    { path: "v1/responses", method: RequestMethod.POST }
  ] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("OIC API")
      .setDescription("Oi Intelligence Core native and compatibility API")
      .setVersion("1.0.0")
      .addBearerAuth()
      .build()
  );
  SwaggerModule.setup("docs", app, document);
  await app.listen(port, config.getOrThrow<string>("OIC_HOST"));
}

void bootstrap();
