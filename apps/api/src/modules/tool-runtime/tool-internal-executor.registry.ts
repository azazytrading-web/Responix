import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { ToolInternalExecutor } from "./tool-runtime.types";

@Injectable()
export class ToolInternalExecutorRegistry {
  private readonly executors = new Map<string, ToolInternalExecutor>();
  register(identifier: string, executor: ToolInternalExecutor) {
    if (!/^[A-Za-z][A-Za-z0-9._:-]{0,159}$/.test(identifier)) {
      throw new ConflictException("Tool executor identifier is invalid");
    }
    if (this.executors.has(identifier)) throw new ConflictException(`Tool executor ${identifier} is already registered`);
    this.executors.set(identifier, executor);
  }
  resolve(identifier: string) {
    const executor = this.executors.get(identifier);
    if (!executor) throw new NotFoundException(`Tool executor ${identifier} is not registered`);
    return executor;
  }
}
