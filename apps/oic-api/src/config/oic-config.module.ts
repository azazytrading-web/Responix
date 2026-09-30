import { Module } from "@nestjs/common";
import { resolve } from "node:path";
import { ConfigModule } from "@nestjs/config";
import { validateOicEnvironment } from "./oic-config.schema";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [resolve(__dirname, "../../../../.env.oic.local")],
      isGlobal: true,
      cache: true,
      validate: validateOicEnvironment
    })
  ]
})
export class OicConfigModule {}