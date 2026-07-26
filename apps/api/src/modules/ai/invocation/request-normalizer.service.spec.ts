import { AiContractError } from "../contracts";
import type { AiRequestContract } from "../contracts";
import { RequestNormalizerService } from "./request-normalizer.service";

function request(overrides: Partial<AiRequestContract> = {}): AiRequestContract {
  return {
    requestId: "request-id",
    workspaceId: "forged-workspace",
    membershipId: "forged-membership",
    taskType: "completion",
    messages: [{ role: "user", content: "Hello" }],
    mode: "sync",
    ...overrides
  };
}

describe("RequestNormalizerService", () => {
  const service = new RequestNormalizerService();
  const tenant = {
    workspace: { id: "trusted-workspace" },
    membership: { id: "trusted-membership" }
  } as never;

  it("ignores forged matching tenant identifiers and uses only trusted context", () => {
    expect(
      service.normalize(
        request({
          workspaceId: "trusted-workspace",
          membershipId: "trusted-membership",
          metadata: { secret: "not-forwarded" }
        }),
        tenant
      )
    ).toEqual({
      requestId: "request-id",
      workspaceId: "trusted-workspace",
      membershipId: "trusted-membership",
      taskType: "completion",
      messages: [{ role: "user", content: "Hello" }]
    });
  });

  it("cannot normalize an invocation into a caller-supplied workspace", () => {
    expect(service.normalize(request(), tenant)).toMatchObject({
      workspaceId: "trusted-workspace",
      membershipId: "trusted-membership"
    });
  });

  it("rejects streaming and tool requests", () => {
    expect(() => service.normalize(request({ mode: "stream" }), tenant)).toThrow(AiContractError);
    expect(() =>
      service.normalize(
        request({
          tools: [{ name: "tool", description: "tool", inputSchema: {} }]
        }),
        tenant
      )
    ).toThrow(AiContractError);
  });
});
