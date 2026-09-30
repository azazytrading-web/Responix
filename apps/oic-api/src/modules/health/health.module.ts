import { Module } from "@nestjs/common";
import { OicDatabaseModule } from "../../database/oic-database.module";
import { HealthController } from "./health.controller";

@Module({ imports: [OicDatabaseModule], controllers: [HealthController] })
export class HealthModule {}