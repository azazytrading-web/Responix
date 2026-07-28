import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AgentStudioController } from "./agent-studio.controller";
import {
  AgentListQueryDto,
  CreateAgentDto,
  RollbackAgentDto
} from "./dto/agent-studio.dto";

describe("AgentStudioController validation and permissions", () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true
  });

  it("accepts a complete validated persistence configuration", async () => {
    await expect(
      pipe.transform(
        {
          name: "Support",
          slug: "support",
          visibility: "WORKSPACE",
          configuration: {
            providerId: "4b63cf22-bde9-4ab3-91a0-6eb153ed1294",
            modelId: "ad0ed78e-4097-4489-a89a-4e5d0c90139a",
            temperature: 0.7,
            topP: 0.9,
            maxTokens: 2000,
            streaming: true,
            timeoutMs: 30000,
            retryPolicy: { maxAttempts: 3, backoffMs: 250 }
          },
          capabilities: {
            toolsEnabled: true,
            streamingEnabled: true,
            reasoningEnabled: true
          },
          promptBindings: [
            {
              role: "SYSTEM",
              promptId: "8de81d26-bad3-4f48-ab2c-4574eedc57fd",
              promptVersionId: "e6516b09-f4dc-4613-a5a0-ab1f0548ec86",
              variableMetadata: [{ name: "locale", type: "string", required: true }]
            }
          ]
        },
        { type: "body", metatype: CreateAgentDto }
      )
    ).resolves.toBeInstanceOf(CreateAgentDto);
  });

  it.each([
    {
      name: "Bad slug",
      slug: "Bad Slug",
      configuration: {
        providerId: "4b63cf22-bde9-4ab3-91a0-6eb153ed1294",
        modelId: "ad0ed78e-4097-4489-a89a-4e5d0c90139a",
        temperature: 0.7,
        maxTokens: 1000
      }
    },
    {
      name: "Bad temperature",
      slug: "bad-temperature",
      configuration: {
        providerId: "4b63cf22-bde9-4ab3-91a0-6eb153ed1294",
        modelId: "ad0ed78e-4097-4489-a89a-4e5d0c90139a",
        temperature: 3,
        maxTokens: 1000
      }
    },
    {
      name: "Bad prompt",
      slug: "bad-prompt",
      configuration: {
        providerId: "4b63cf22-bde9-4ab3-91a0-6eb153ed1294",
        modelId: "ad0ed78e-4097-4489-a89a-4e5d0c90139a",
        temperature: 0.7,
        maxTokens: 1000
      },
      promptBindings: [{ role: "SYSTEM", promptId: "invalid" }]
    }
  ])("rejects invalid agent configuration %#", async (payload) => {
    await expect(
      pipe.transform(payload, { type: "body", metatype: CreateAgentDto })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects invalid rollback revisions", async () => {
    await expect(
      pipe.transform(
        { revision: 0 },
        { type: "body", metatype: RollbackAgentDto }
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("transforms and validates list pagination", async () => {
    const query = (await pipe.transform(
      { page: "2", limit: "50", status: "PUBLISHED", visibility: "PRIVATE" },
      { type: "query", metatype: AgentListQueryDto }
    )) as AgentListQueryDto;
    expect(query).toMatchObject({
      page: 2,
      limit: 50,
      status: "PUBLISHED",
      visibility: "PRIVATE"
    });
  });

  it("uses dedicated permissions for each lifecycle boundary", () => {
    const reflector = new Reflector();
    /* eslint-disable @typescript-eslint/unbound-method */
    expect(reflector.get("permissions", AgentStudioController.prototype.list)).toEqual([
      "agent.studio.read"
    ]);
    expect(reflector.get("permissions", AgentStudioController.prototype.create)).toEqual([
      "agent.studio.write"
    ]);
    expect(reflector.get("permissions", AgentStudioController.prototype.publish)).toEqual([
      "agent.studio.publish"
    ]);
    expect(reflector.get("permissions", AgentStudioController.prototype.rollback)).toEqual([
      "agent.studio.rollback"
    ]);
    expect(reflector.get("permissions", AgentStudioController.prototype.archive)).toEqual([
      "agent.studio.archive"
    ]);
    expect(reflector.get("permissions", AgentStudioController.prototype.delete)).toEqual([
      "agent.studio.delete"
    ]);
    /* eslint-enable @typescript-eslint/unbound-method */
  });
});
