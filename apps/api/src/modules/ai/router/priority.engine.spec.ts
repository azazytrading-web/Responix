import { FallbackEngine } from "./fallback.engine";
import { PriorityEngine } from "./priority.engine";
import { routingCandidate } from "./routing.test-fixtures";

describe("PriorityEngine and FallbackEngine", () => {
  const priority = new PriorityEngine();
  const fallback = new FallbackEngine(priority);

  it("orders candidates by provider, model, credential, then stable identifiers", () => {
    const candidates = [
      routingCandidate({
        providerId: "provider-b",
        modelId: "model-b",
        providerPriority: 20,
        modelPriority: 1
      }),
      routingCandidate({
        providerId: "provider-a",
        modelId: "model-c",
        providerPriority: 20,
        modelPriority: 10,
        credentialPriority: 5
      }),
      routingCandidate({
        providerId: "provider-a",
        modelId: "model-a",
        providerPriority: 20,
        modelPriority: 10,
        credentialPriority: 5
      })
    ];

    expect(priority.order(candidates).map(({ modelId }) => modelId)).toEqual([
      "model-a",
      "model-c",
      "model-b"
    ]);
  });

  it("returns ordered fallbacks without the selected candidate", () => {
    const selected = routingCandidate({ modelId: "selected" });
    const lower = routingCandidate({
      providerId: "provider-b",
      modelId: "lower",
      providerPriority: 5
    });

    expect(fallback.order([lower, selected], selected)).toEqual([lower]);
  });
});
