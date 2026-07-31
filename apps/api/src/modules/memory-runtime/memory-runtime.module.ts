import { Module } from "@nestjs/common";
import { MemoryRuntimeController } from "./memory-runtime.controller";
import { MemoryRuntimeRepository } from "./memory-runtime.repository";
import { MemoryRuntimeService } from "./memory-runtime.service";
import { MEMORY_RUNTIME_STORE } from "./memory-runtime.types";
import { MemoryRuntimeValidator } from "./memory-runtime.validator";

@Module({
  controllers: [MemoryRuntimeController],
  providers: [
    MemoryRuntimeValidator, MemoryRuntimeRepository,
    { provide: MEMORY_RUNTIME_STORE, useExisting: MemoryRuntimeRepository },
    MemoryRuntimeService
  ],
  exports: [MemoryRuntimeService, MEMORY_RUNTIME_STORE]
})
export class MemoryRuntimeModule {}
