import { Module } from "@nestjs/common";
import { RuntimeOptimizationController } from "./runtime-optimization.controller";
import { RuntimeOptimizationRepository } from "./runtime-optimization.repository";
import { RuntimeOptimizationService } from "./runtime-optimization.service";
import { RuntimeOptimizationValidator } from "./runtime-optimization.validator";

@Module({
  controllers: [RuntimeOptimizationController],
  providers: [
    RuntimeOptimizationValidator, RuntimeOptimizationRepository, RuntimeOptimizationService
  ],
  exports: [RuntimeOptimizationService]
})
export class RuntimeOptimizationModule {}
