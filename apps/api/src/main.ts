import { ValidationPipe, VersioningType } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app/app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true
  });
  const configService = app.get(ConfigService);
  const port = configService.getOrThrow<number>("api.port");

  app.use(helmet());
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
}

void bootstrap();
