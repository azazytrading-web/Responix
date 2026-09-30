import { Module } from "@nestjs/common";
import { OicDatabaseService } from "@oic/database";

@Module({
  providers: [OicDatabaseService],
  exports: [OicDatabaseService]
})
export class OicDatabaseModule {}