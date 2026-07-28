import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  CompareProviderSnapshotsDto,
  PrepareProviderRequestDto,
  ProviderRequestListQueryDto,
  ProviderSnapshotListQueryDto
} from "./dto/provider-runtime.dto";
import { ProviderRuntimeController } from "./provider-runtime.controller";

describe("ProviderRuntimeController validation and permissions", () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true
  });

  it("accepts complete provider request metadata", async () => {
    const result = await pipe.transform({
      compiledPromptId: "11111111-1111-4111-8111-111111111111",
      agentRuntimeSnapshotId: "22222222-2222-4222-8222-222222222222",
      estimatedInputTokens: 500,
      maxOutputTokens: 250,
      temperature: 0.7,
      topP: 0.9,
      stopSequences: ["END"],
      structuredOutput: true,
      requestMetadata: { source: "api" },
      safetyMetadata: { moderation: true },
      traceMetadata: { span: "prepare" }
    }, { type: "body", metatype: PrepareProviderRequestDto }) as PrepareProviderRequestDto;
    expect(result).toBeInstanceOf(PrepareProviderRequestDto);
    expect(result.estimatedInputTokens).toBe(500);
  });

  it.each([
    {},
    {
      compiledPromptId: "invalid",
      agentRuntimeSnapshotId: "invalid",
      estimatedInputTokens: -1
    },
    {
      compiledPromptId: "11111111-1111-4111-8111-111111111111",
      agentRuntimeSnapshotId: "22222222-2222-4222-8222-222222222222",
      estimatedInputTokens: 1,
      stopSequences: [1]
    },
    {
      compiledPromptId: "11111111-1111-4111-8111-111111111111",
      agentRuntimeSnapshotId: "22222222-2222-4222-8222-222222222222",
      estimatedInputTokens: 1,
      unknown: true
    }
  ])("rejects invalid preparation DTO %#", async (payload) => {
    await expect(pipe.transform(payload, {
      type: "body",
      metatype: PrepareProviderRequestDto
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("transforms paginated request and snapshot filters", async () => {
    const requests = await pipe.transform({
      page: "2",
      limit: "50",
      status: "VALIDATED",
      providerId: "11111111-1111-4111-8111-111111111111"
    }, { type: "query", metatype: ProviderRequestListQueryDto }) as ProviderRequestListQueryDto;
    const snapshots = await pipe.transform({
      page: "3",
      requestId: "22222222-2222-4222-8222-222222222222"
    }, { type: "query", metatype: ProviderSnapshotListQueryDto }) as ProviderSnapshotListQueryDto;
    expect(requests).toMatchObject({ page: 2, limit: 50, status: "VALIDATED" });
    expect(snapshots).toMatchObject({ page: 3 });
  });

  it("validates snapshot comparison IDs", async () => {
    await expect(pipe.transform({
      leftId: "11111111-1111-4111-8111-111111111111",
      rightId: "22222222-2222-4222-8222-222222222222"
    }, { type: "query", metatype: CompareProviderSnapshotsDto }))
      .resolves.toBeInstanceOf(CompareProviderSnapshotsDto);
    await expect(pipe.transform({
      leftId: "invalid",
      rightId: "invalid"
    }, { type: "query", metatype: CompareProviderSnapshotsDto }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it("declares dedicated Provider Runtime permissions", () => {
    const reflector = new Reflector();
    /* eslint-disable @typescript-eslint/unbound-method */
    expect(reflector.get("permissions", ProviderRuntimeController.prototype.prepare))
      .toEqual(["provider.runtime.prepare"]);
    expect(reflector.get("permissions", ProviderRuntimeController.prototype.validate))
      .toEqual(["provider.runtime.validate"]);
    expect(reflector.get("permissions", ProviderRuntimeController.prototype.createSnapshot))
      .toEqual(["provider.runtime.snapshot"]);
    expect(reflector.get("permissions", ProviderRuntimeController.prototype.listRequests))
      .toEqual(["provider.runtime.read"]);
    expect(reflector.get("permissions", ProviderRuntimeController.prototype.getSnapshot))
      .toEqual(["provider.runtime.read"]);
    expect(reflector.get("permissions", ProviderRuntimeController.prototype.compare))
      .toEqual(["provider.runtime.manage"]);
    /* eslint-enable @typescript-eslint/unbound-method */
  });
});
