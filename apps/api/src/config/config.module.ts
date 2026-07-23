import { Module } from "@nestjs/common";
import { ConfigModule as NestConfigModule } from "@nestjs/config";
import { configuration } from "./configuration";
import { validateEnvironment } from "./environment.schema";

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnvironment
    })
  ]
})
export class ConfigModule {}
