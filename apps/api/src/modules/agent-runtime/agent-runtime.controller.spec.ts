import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  AgentRuntimeListQueryDto,
  PrepareAgentRuntimeDto
} from "./dto/agent-runtime.dto";
import { AgentRuntimeController } from "./agent-runtime.controller";

describe("AgentRuntimeController validation and permissions", () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true
  });

  it("accepts a complete preparation context and transforms nested variables", async () => {
    const dto = await pipe.transform({
      agentId: "11111111-1111-4111-8111-111111111111",
      executionProfileId: "22222222-2222-4222-8222-222222222222",
      executionRequestId: "33333333-3333-4333-8333-333333333333",
      context: {
        traceId: "trace-1",
        locale: "en-US",
        timezone: "Africa/Cairo",
        environmentMetadata: { stage: "test" }
      },
      variables: [{
        name: "customerName",
        type: "STRING",
        source: "EXECUTION_REQUEST",
        value: "Ada"
      }],
      conversation: {
        historyReferences: [{ messageId: "history-1" }],
        tokenAccountingMetadata: { input: 0 }
      },
      prompt: {
        attachments: [{ id: "attachment-1", mimeType: "text/plain" }]
      }
    }, { type: "body", metatype: PrepareAgentRuntimeDto }) as PrepareAgentRuntimeDto;
    expect(dto).toBeInstanceOf(PrepareAgentRuntimeDto);
    expect(dto.variables?.[0]?.name).toBe("customerName");
  });

  it.each([
    {},
    {
      agentId: "invalid",
      executionProfileId: "invalid",
      executionRequestId: "invalid",
      context: { traceId: "bad trace" }
    },
    {
      agentId: "11111111-1111-4111-8111-111111111111",
      executionProfileId: "22222222-2222-4222-8222-222222222222",
      executionRequestId: "33333333-3333-4333-8333-333333333333",
      context: { traceId: "trace" },
      variables: [{ name: "name", type: "UNKNOWN", source: "AGENT", value: true }]
    },
    {
      agentId: "11111111-1111-4111-8111-111111111111",
      executionProfileId: "22222222-2222-4222-8222-222222222222",
      executionRequestId: "33333333-3333-4333-8333-333333333333",
      context: { traceId: "trace" },
      unknown: true
    }
  ])("rejects invalid preparation payload %#", async (payload) => {
    await expect(pipe.transform(payload, {
      type: "body",
      metatype: PrepareAgentRuntimeDto
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("transforms validated pagination filters", async () => {
    const query = await pipe.transform({
      page: "2",
      limit: "50",
      status: "VALIDATED",
      agentId: "11111111-1111-4111-8111-111111111111"
    }, { type: "query", metatype: AgentRuntimeListQueryDto }) as AgentRuntimeListQueryDto;
    expect(query).toMatchObject({ page: 2, limit: 50, status: "VALIDATED" });
  });

  it("declares dedicated Agent Runtime permissions", () => {
    const reflector = new Reflector();
    /* eslint-disable @typescript-eslint/unbound-method */
    expect(reflector.get("permissions", AgentRuntimeController.prototype.prepare)).toEqual(["agent.runtime.prepare"]);
    expect(reflector.get("permissions", AgentRuntimeController.prototype.list)).toEqual(["agent.runtime.read"]);
    expect(reflector.get("permissions", AgentRuntimeController.prototype.validate)).toEqual(["agent.runtime.validate"]);
    expect(reflector.get("permissions", AgentRuntimeController.prototype.snapshot)).toEqual(["agent.runtime.snapshot"]);
    expect(reflector.get("permissions", AgentRuntimeController.prototype.resolve)).toEqual(["agent.runtime.manage"]);
    /* eslint-enable @typescript-eslint/unbound-method */
  });
});

