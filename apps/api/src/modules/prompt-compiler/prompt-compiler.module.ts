import { Module } from "@nestjs/common";
import { PromptCompilerController } from "./prompt-compiler.controller";
import { PromptCompilerEngine } from "./prompt-compiler.engine";
import { PromptCompilerRepository } from "./prompt-compiler.repository";
import { PromptCompilerService } from "./prompt-compiler.service";

@Module({
  controllers: [PromptCompilerController],
  providers: [PromptCompilerEngine, PromptCompilerRepository, PromptCompilerService],
  exports: [PromptCompilerService]
})
export class PromptCompilerModule {}

