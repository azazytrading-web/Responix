import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  CompareExecutionPipelineSnapshotsDto, CreateExecutionPipelineDto,
  ExecutionPipelineListQueryDto, RollbackExecutionPipelineDto
} from "./dto/execution-pipeline.dto";
import { ExecutionPipelineController } from "./execution-pipeline.controller";

describe("ExecutionPipelineController validation and permissions", () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
  it("accepts complete metadata-only pipeline DTOs", async () => {
    const result = await pipe.transform({
      name: "Pipeline", compatibilityVersion: "1.0.0",
      nodes: [
        { nodeKey: "start", stage: "START", ordinal: 0 },
        {
          nodeKey: "agent", stage: "AGENT", ordinal: 1, assetType: "AGENT_RUNTIME",
          assetId: "11111111-1111-4111-8111-111111111111"
        }
      ],
      dependencies: [{ dependencyKey: "edge", fromNodeKey: "start", toNodeKey: "agent" }],
      variables: [{ name: "customer", type: "STRING", value: "Ada" }]
    }, { type: "body", metatype: CreateExecutionPipelineDto }) as CreateExecutionPipelineDto;
    expect(result).toBeInstanceOf(CreateExecutionPipelineDto);
    expect(result.nodes[1]?.assetType).toBe("AGENT_RUNTIME");
  });
  it.each([
    {},
    { name: "Pipeline", compatibilityVersion: "invalid", nodes: [] },
    { name: "Pipeline", compatibilityVersion: "1.0.0", nodes: [{ nodeKey: "bad key", stage: "A", ordinal: -1 }] },
    { name: "Pipeline", compatibilityVersion: "1.0.0", nodes: [], unknown: true }
  ])("rejects invalid pipeline DTO %#", async (payload) => {
    await expect(pipe.transform(payload, { type: "body", metatype: CreateExecutionPipelineDto }))
      .rejects.toBeInstanceOf(BadRequestException);
  });
  it("transforms lifecycle and pagination DTOs", async () => {
    await expect(pipe.transform({ revisionId: "11111111-1111-4111-8111-111111111111" }, {
      type: "body", metatype: RollbackExecutionPipelineDto
    })).resolves.toBeInstanceOf(RollbackExecutionPipelineDto);
    const query = await pipe.transform({ page: "2", limit: "50", status: "PUBLISHED" }, {
      type: "query", metatype: ExecutionPipelineListQueryDto
    }) as ExecutionPipelineListQueryDto;
    expect(query).toMatchObject({ page: 2, limit: 50, status: "PUBLISHED" });
    await expect(pipe.transform({
      leftId: "11111111-1111-4111-8111-111111111111",
      rightId: "22222222-2222-4222-8222-222222222222"
    }, { type: "query", metatype: CompareExecutionPipelineSnapshotsDto }))
      .resolves.toBeInstanceOf(CompareExecutionPipelineSnapshotsDto);
  });
  it("declares dedicated endpoint permissions", () => {
    const reflector = new Reflector();
    /* eslint-disable @typescript-eslint/unbound-method */
    expect(reflector.get("permissions", ExecutionPipelineController.prototype.create))
      .toEqual(["execution.pipeline.create"]);
    expect(reflector.get("permissions", ExecutionPipelineController.prototype.update))
      .toEqual(["execution.pipeline.update"]);
    expect(reflector.get("permissions", ExecutionPipelineController.prototype.publish))
      .toEqual(["execution.pipeline.publish"]);
    expect(reflector.get("permissions", ExecutionPipelineController.prototype.rollback))
      .toEqual(["execution.pipeline.rollback"]);
    expect(reflector.get("permissions", ExecutionPipelineController.prototype.archive))
      .toEqual(["execution.pipeline.archive"]);
    expect(reflector.get("permissions", ExecutionPipelineController.prototype.restore))
      .toEqual(["execution.pipeline.restore"]);
    expect(reflector.get("permissions", ExecutionPipelineController.prototype.softDelete))
      .toEqual(["execution.pipeline.delete"]);
    expect(reflector.get("permissions", ExecutionPipelineController.prototype.list))
      .toEqual(["execution.pipeline.read"]);
    /* eslint-enable @typescript-eslint/unbound-method */
  });
});
