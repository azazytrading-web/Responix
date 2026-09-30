import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { VersioningType } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app/app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const port = Number(process.env.OIC_PORT ?? 4100);
  app.enableShutdownHooks();
  app.use((request: { headers: Record<string, string | string[] | undefined>; requestId?: string }, response: { setHeader(name: string, value: string): void }, next: () => void) => {
    const candidate = request.headers["x-request-id"];
    const supplied = Array.isArray(candidate) ? candidate[0] : candidate;
    request.requestId = supplied && /^[A-Za-z0-9._:-]{1,128}$/.test(supplied) ? supplied : randomUUID();
    response.setHeader("x-request-id", request.requestId);
    next();
  });
  app.setGlobalPrefix("api");
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("OIC API")
      .setDescription("Oi Intelligence Core foundation API")
      .setVersion("1.0.0")
      .build()
  );
  SwaggerModule.setup("docs", app, document);
  await app.listen(port, "0.0.0.0");
}

void bootstrap();