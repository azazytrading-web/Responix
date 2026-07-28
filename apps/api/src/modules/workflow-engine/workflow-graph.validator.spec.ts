import { BadRequestException } from "@nestjs/common";
import { WorkflowGraphValidator, type WorkflowGraph } from "./workflow-graph.validator";

describe("WorkflowGraphValidator", () => {
  const validator = new WorkflowGraphValidator();
  const valid = (): WorkflowGraph => ({
    nodes: [
      { id: "start", type: "START" as const },
      { id: "decision", type: "DECISION" as const },
      { id: "end", type: "END" as const }
    ],
    edges: [
      { id: "start-decision", sourceNodeId: "start", targetNodeId: "decision" },
      { id: "decision-end", sourceNodeId: "decision", targetNodeId: "end" }
    ],
    conditions: [
      { key: "approved", edgeId: "decision-end", expression: { op: "eq" } }
    ],
    branches: [
      { nodeId: "decision", key: "yes", targetNodeId: "end", condition: { value: true } }
    ]
  });

  it("accepts a complete graph", () => expect(() => validator.validate(valid())).not.toThrow());

  it.each([
    ["duplicate node IDs", (g: ReturnType<typeof valid>) => g.nodes.push({ ...g.nodes[0]! })],
    ["duplicate edge IDs", (g: ReturnType<typeof valid>) => g.edges.push({ ...g.edges[0]! })],
    ["broken source", (g: ReturnType<typeof valid>) => { g.edges[0]!.sourceNodeId = "missing"; }],
    ["missing start", (g: ReturnType<typeof valid>) => { g.nodes[0]!.type = "MANUAL"; }],
    ["outgoing end", (g: ReturnType<typeof valid>) => g.edges.push({ id: "bad", sourceNodeId: "end", targetNodeId: "decision" })],
    ["unreachable node", (g: ReturnType<typeof valid>) => g.nodes.push({ id: "orphan", type: "CUSTOM" })],
    ["broken condition", (g: ReturnType<typeof valid>) => { g.conditions[0]!.edgeId = "missing"; }],
    ["invalid branch source", (g: ReturnType<typeof valid>) => { g.branches[0]!.nodeId = "start"; }]
  ])("rejects %s", (_label, mutate) => {
    const graph = valid();
    mutate(graph);
    expect(() => validator.validate(graph)).toThrow(BadRequestException);
  });

  it("rejects ordinary cycles and permits cycles explicitly controlled by LOOP nodes", () => {
    const cyclic = valid();
    cyclic.edges.push({ id: "cycle", sourceNodeId: "decision", targetNodeId: "start" });
    expect(() => validator.validate(cyclic)).toThrow(BadRequestException);

    const loop = valid();
    loop.nodes[1]!.type = "LOOP";
    loop.edges.push({ id: "cycle", sourceNodeId: "decision", targetNodeId: "decision" });
    expect(() => validator.validate(loop)).toThrow(BadRequestException);
    loop.edges[2] = { id: "cycle", sourceNodeId: "decision", targetNodeId: "start" };
    expect(() => validator.validate(loop)).toThrow(BadRequestException);

    const allowed = valid();
    allowed.nodes.splice(1, 1, { id: "loop", type: "LOOP" as const }, { id: "work", type: "CUSTOM" as const });
    allowed.edges.splice(
      0,
      allowed.edges.length,
      { id: "a", sourceNodeId: "start", targetNodeId: "loop" },
      { id: "b", sourceNodeId: "loop", targetNodeId: "work" },
      { id: "c", sourceNodeId: "work", targetNodeId: "loop" },
      { id: "d", sourceNodeId: "loop", targetNodeId: "end" }
    );
    allowed.conditions = [];
    allowed.branches = [{ nodeId: "loop", key: "done", targetNodeId: "end", condition: { done: true } }];
    expect(() => validator.validate(allowed)).not.toThrow();
  });
});
