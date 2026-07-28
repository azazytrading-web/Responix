import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  CompareCompiledPromptsDto,
  CompilePromptDto,
  CompiledPromptListQueryDto
} from "./dto/prompt-compiler.dto";
import { PromptCompilerController } from "./prompt-compiler.controller";

describe("PromptCompilerController validation and permissions", () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true
  });

  it("accepts complete nested compiler metadata", async () => {
    const result = await pipe.transform({
      promptId: "11111111-1111-4111-8111-111111111111",
      promptVersionId: "22222222-2222-4222-8222-222222222222",
      sections: {
        systemPrompt: "System {{workspace.name}}",
        userPrompt: "Hello {{name}}"
      },
      assistantHistory: [{ content: "Earlier {{name}}", metadata: { turn: 1 } }],
      metadataBlocks: [{ type: "context", content: { locale: "{{workspace.locale}}" } }],
      conditions: [{ variable: "name", operator: "EXISTS" }],
      variables: [{
        name: "name",
        type: "STRING",
        source: "EXECUTION_RUNTIME",
        value: "Ada"
      }],
      maxPromptSizeBytes: 100000
    }, { type: "body", metatype: CompilePromptDto }) as CompilePromptDto;
    expect(result).toBeInstanceOf(CompilePromptDto);
    expect(result.variables?.[0]?.name).toBe("name");
  });

  it.each([
    {},
    { promptId: "invalid", promptVersionId: "invalid" },
    {
      promptId: "11111111-1111-4111-8111-111111111111",
      promptVersionId: "22222222-2222-4222-8222-222222222222",
      variables: [{ name: "bad name", type: "UNKNOWN", source: "UNKNOWN" }]
    },
    {
      promptId: "11111111-1111-4111-8111-111111111111",
      promptVersionId: "22222222-2222-4222-8222-222222222222",
      maxPromptSizeBytes: 1000001
    },
    {
      promptId: "11111111-1111-4111-8111-111111111111",
      promptVersionId: "22222222-2222-4222-8222-222222222222",
      unknown: true
    }
  ])("rejects invalid compile DTO %#", async (payload) => {
    await expect(pipe.transform(payload, {
      type: "body",
      metatype: CompilePromptDto
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("transforms list and compare query DTOs", async () => {
    const list = await pipe.transform({
      page: "2",
      limit: "50",
      promptId: "11111111-1111-4111-8111-111111111111"
    }, { type: "query", metatype: CompiledPromptListQueryDto }) as CompiledPromptListQueryDto;
    expect(list).toMatchObject({ page: 2, limit: 50 });
    await expect(pipe.transform({
      leftId: "11111111-1111-4111-8111-111111111111",
      rightId: "22222222-2222-4222-8222-222222222222"
    }, { type: "query", metatype: CompareCompiledPromptsDto }))
      .resolves.toBeInstanceOf(CompareCompiledPromptsDto);
  });

  it("declares dedicated Prompt Compiler permissions", () => {
    const reflector = new Reflector();
    /* eslint-disable @typescript-eslint/unbound-method */
    expect(reflector.get("permissions", PromptCompilerController.prototype.compile)).toEqual(["prompt.compiler.compile"]);
    expect(reflector.get("permissions", PromptCompilerController.prototype.preview)).toEqual(["prompt.compiler.preview"]);
    expect(reflector.get("permissions", PromptCompilerController.prototype.validate)).toEqual(["prompt.compiler.validate"]);
    expect(reflector.get("permissions", PromptCompilerController.prototype.list)).toEqual(["prompt.compiler.read"]);
    expect(reflector.get("permissions", PromptCompilerController.prototype.compare)).toEqual(["prompt.compiler.manage"]);
    /* eslint-enable @typescript-eslint/unbound-method */
  });
});

