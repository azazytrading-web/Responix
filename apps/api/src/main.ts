import { ValidationPipe, VersioningType } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import compression from "compression";
import helmet from "helmet";
import { Logger, LoggerErrorInterceptor } from "nestjs-pino";
import { AppModule } from "./app/app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true
  });
  const configService = app.get(ConfigService);
  const logger = app.get(Logger);
  const port = configService.getOrThrow<number>("api.port");
  const trustProxy = configService.getOrThrow<boolean>("api.trustProxy");
  const compressionEnabled = configService.getOrThrow<boolean>("api.compressionEnabled");

  app.useLogger(logger);
  app.flushLogs();
  app.enableShutdownHooks();

  if (trustProxy) {
    app.set("trust proxy", 1);
  }

  app.use(helmet());
  if (compressionEnabled) {
    app.use(compression());
  }
  app.enableCors({
    origin: configService.getOrThrow<string>("dashboard.url"),
    credentials: true
  });
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1"
  });
  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );
  app.useGlobalInterceptors(new LoggerErrorInterceptor());

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("Responix API")
      .setDescription("Enterprise multi-tenant AI customer engagement API")
      .setVersion("1.0.0")
      .addBearerAuth()
      .build()
  );
  SwaggerModule.setup("docs", app, document);

  await app.listen(port);
  logger.log(`API listening on port ${port}`);
}

void bootstrap();
