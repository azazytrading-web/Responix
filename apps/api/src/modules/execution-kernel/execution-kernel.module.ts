import { Module } from "@nestjs/common";
import { ExecutionKernelController } from "./execution-kernel.controller";
import { ExecutionKernelRepository } from "./execution-kernel.repository";
import { ExecutionKernelService } from "./execution-kernel.service";
import { ExecutionStateMachine } from "./execution-state-machine";

@Module({
  controllers: [ExecutionKernelController],
  providers: [ExecutionStateMachine, ExecutionKernelRepository, ExecutionKernelService],
  exports: [ExecutionKernelService]
})
export class ExecutionKernelModule {}
