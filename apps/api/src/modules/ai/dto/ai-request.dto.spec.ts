import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { AiInvocationRequestDto, AiRoutingRequestDto } from "./ai-request.dto";

describe("AI request DTOs", () => {
  it("accepts a supported synchronous invocation", async () => {
    const dto = plainToInstance(AiInvocationRequestDto, {
      taskType: "completion",
      messages: [{ role: "user", content: "Hello" }],
      mode: "sync"
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it("rejects streaming, tool messages, and invalid routing limits", async () => {
    const invocation = plainToInstance(AiInvocationRequestDto, {
      taskType: "completion",
      messages: [{ role: "tool", content: "payload" }],
      mode: "stream"
    });
    const routing = plainToInstance(AiRoutingRequestDto, {
      minimumContextWindow: 0
    });

    expect(await validate(invocation)).toHaveLength(2);
    expect(await validate(routing)).toHaveLength(1);
  });
});
