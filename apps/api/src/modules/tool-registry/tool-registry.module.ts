import { Module } from "@nestjs/common";
import { ToolRegistryController } from "./tool-registry.controller";
import { ToolRegistryRepository } from "./tool-registry.repository";
import { ToolRegistryService } from "./tool-registry.service";

@Module({
  controllers: [ToolRegistryController],
  providers: [ToolRegistryRepository, ToolRegistryService]
})
export class ToolRegistryModule {}
