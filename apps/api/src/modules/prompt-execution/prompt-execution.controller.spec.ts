import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  PromptExecutionListQueryDto, RenderPromptExecutionDto
} from "./dto/prompt-execution.dto";
import { PromptExecutionController } from "./prompt-execution.controller";

describe("PromptExecutionController validation and permissions", () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
  it("accepts nested runtime variables and conversation context", async () => {
    const result = await pipe.transform({
      compiledPromptId: "11111111-1111-4111-8111-111111111111",
      variables: [{ name: "customer", type: "OBJECT", value: { name: "Ada" } }],
      conversationMessages: [{ role: "user", content: "Earlier question" }],
      assistantHistory: [{ content: "Earlier answer" }],
      runtimeMetadata: { locale: "en" }
    }, { type: "body", metatype: RenderPromptExecutionDto }) as RenderPromptExecutionDto;
    expect(result).toBeInstanceOf(RenderPromptExecutionDto);
    expect(result.variables?.[0]?.value).toEqual({ name: "Ada" });
  });
  it.each([
    {},
    { compiledPromptId: "invalid" },
    {
      compiledPromptId: "11111111-1111-4111-8111-111111111111",
      variables: [{ name: "bad name", type: "UNKNOWN" }]
    },
    {
      compiledPromptId: "11111111-1111-4111-8111-111111111111",
      conversationMessages: [{ role: "tool", content: "not allowed" }]
    },
    {
      compiledPromptId: "11111111-1111-4111-8111-111111111111", unknown: true
    }
  ])("rejects invalid execution DTO %#", async (payload) => {
    await expect(pipe.transform(payload, {
      type: "body", metatype: RenderPromptExecutionDto
    })).rejects.toBeInstanceOf(BadRequestException);
  });
  it("transforms pagination filters", async () => {
    const result = await pipe.transform({
      page: "2", limit: "50",
      compiledPromptId: "11111111-1111-4111-8111-111111111111"
    }, { type: "query", metatype: PromptExecutionListQueryDto }) as PromptExecutionListQueryDto;
    expect(result).toMatchObject({ page: 2, limit: 50 });
  });
  it("declares dedicated prompt execution permissions", () => {
    const reflector = new Reflector();
    /* eslint-disable @typescript-eslint/unbound-method */
    expect(reflector.get("permissions", PromptExecutionController.prototype.render))
      .toEqual(["prompt.execution.render"]);
    expect(reflector.get("permissions", PromptExecutionController.prototype.validate))
      .toEqual(["prompt.execution.validate"]);
    expect(reflector.get("permissions", PromptExecutionController.prototype.list))
      .toEqual(["prompt.execution.read"]);
    expect(reflector.get("permissions", PromptExecutionController.prototype.get))
      .toEqual(["prompt.execution.read"]);
    /* eslint-enable @typescript-eslint/unbound-method */
  });
});
