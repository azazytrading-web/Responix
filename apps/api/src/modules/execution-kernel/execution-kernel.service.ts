import { Injectable } from "@nestjs/common";
import type {
  AppendExecutionEventDto,
  AppendExecutionLogDto,
  CancelExecutionDto,
  CreateExecutionRequestDto,
  CreateExecutionRunDto,
  ExecutionRequestListQueryDto,
  ExecutionRunListQueryDto,
  RecordExecutionFailureDto,
  RecordExecutionStepDto,
  TransitionExecutionDto
} from "./dto/execution-kernel.dto";
import { ExecutionKernelRepository } from "./execution-kernel.repository";

@Injectable()
export class ExecutionKernelService {
  constructor(private readonly repository: ExecutionKernelRepository) {}

  createRequest(w: string, a: string, d: CreateExecutionRequestDto) {
    return this.repository.createRequest(w, a, d);
  }
  createRun(w: string, a: string, requestId: string, d: CreateExecutionRunDto) {
    return this.repository.createRun(w, a, requestId, d);
  }
  transition(w: string, a: string, runId: string, d: TransitionExecutionDto) {
    return this.repository.transition(w, a, runId, d);
  }
  cancel(w: string, a: string, runId: string, d: CancelExecutionDto) {
    return this.repository.cancel(w, a, runId, d);
  }
  recordFailure(w: string, a: string, runId: string, d: RecordExecutionFailureDto) {
    return this.repository.recordFailure(w, a, runId, d);
  }
  recordStep(w: string, a: string, runId: string, d: RecordExecutionStepDto) {
    return this.repository.recordStep(w, a, runId, d);
  }
  appendEvent(w: string, a: string, runId: string, d: AppendExecutionEventDto) {
    return this.repository.appendEvent(w, a, runId, d);
  }
  appendLog(w: string, a: string, runId: string, d: AppendExecutionLogDto) {
    return this.repository.appendLog(w, a, runId, d);
  }
  getRequest(w: string, id: string) { return this.repository.getRequest(w, id); }
  getRun(w: string, id: string) { return this.repository.getRun(w, id); }
  listRequests(w: string, q: ExecutionRequestListQueryDto) {
    return this.repository.listRequests({
      workspaceId: w, page: q.page ?? 1, limit: q.limit ?? 25,
      sourceType: q.sourceType, correlationId: q.correlationId,
      requestedById: q.requestedById
    });
  }
  listRuns(w: string, q: ExecutionRunListQueryDto) {
    return this.repository.listRuns({
      workspaceId: w, page: q.page ?? 1, limit: q.limit ?? 25,
      status: q.status, requestId: q.requestId, correlationId: q.correlationId
    });
  }
}
