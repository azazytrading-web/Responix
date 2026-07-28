import { BadRequestException, Injectable } from "@nestjs/common";
import type {
  WorkflowBranchDto,
  WorkflowConditionDto,
  WorkflowEdgeDto,
  WorkflowNodeDto
} from "./dto/workflow-engine.dto";

export type WorkflowGraph = {
  nodes: WorkflowNodeDto[];
  edges: WorkflowEdgeDto[];
  conditions: WorkflowConditionDto[];
  branches: WorkflowBranchDto[];
};

@Injectable()
export class WorkflowGraphValidator {
  validate(graph: WorkflowGraph): void {
    this.unique(graph.nodes.map((node) => node.id), "Workflow node IDs");
    this.unique(graph.edges.map((edge) => edge.id), "Workflow edge IDs");
    this.unique(graph.conditions.map((condition) => condition.key), "Workflow condition keys");
    this.unique(
      graph.branches.map((branch) => `${branch.nodeId}:${branch.key}`),
      "Workflow branch keys"
    );

    const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
    const edges = new Map(graph.edges.map((edge) => [edge.id, edge]));
    const starts = graph.nodes.filter((node) => node.type === "START");
    const ends = graph.nodes.filter((node) => node.type === "END");
    if (starts.length !== 1) {
      throw new BadRequestException("Workflow graph requires exactly one START node");
    }
    if (ends.length === 0) {
      throw new BadRequestException("Workflow graph requires at least one END node");
    }

    for (const edge of graph.edges) {
      if (!nodes.has(edge.sourceNodeId) || !nodes.has(edge.targetNodeId)) {
        throw new BadRequestException(`Workflow edge ${edge.id} contains a broken node reference`);
      }
      if (edge.sourceNodeId === edge.targetNodeId) {
        throw new BadRequestException(`Workflow edge ${edge.id} cannot reference the same node`);
      }
      if (nodes.get(edge.sourceNodeId)?.type === "END") {
        throw new BadRequestException("END nodes cannot have outgoing edges");
      }
      if (nodes.get(edge.targetNodeId)?.type === "START") {
        throw new BadRequestException("START nodes cannot have incoming edges");
      }
    }

    for (const condition of graph.conditions) {
      if ((condition.nodeId ? 1 : 0) + (condition.edgeId ? 1 : 0) !== 1) {
        throw new BadRequestException(`Workflow condition ${condition.key} must reference one node or edge`);
      }
      if (condition.nodeId && !nodes.has(condition.nodeId)) {
        throw new BadRequestException(`Workflow condition ${condition.key} has a broken node reference`);
      }
      if (condition.edgeId && !edges.has(condition.edgeId)) {
        throw new BadRequestException(`Workflow condition ${condition.key} has a broken edge reference`);
      }
    }

    for (const branch of graph.branches) {
      const source = nodes.get(branch.nodeId);
      if (!source || !nodes.has(branch.targetNodeId)) {
        throw new BadRequestException(`Workflow branch ${branch.key} contains a broken node reference`);
      }
      if (!["CONDITION", "DECISION", "LOOP"].includes(source.type)) {
        throw new BadRequestException("Workflow branches require a CONDITION, DECISION, or LOOP node");
      }
    }

    this.assertReachable(starts[0]!.id, graph.nodes, graph.edges);
    this.assertCyclesAllowed(graph.nodes, graph.edges);
  }

  private assertReachable(startId: string, nodes: WorkflowNodeDto[], edges: WorkflowEdgeDto[]): void {
    const adjacency = this.adjacency(edges);
    const visited = new Set<string>();
    const pending = [startId];
    while (pending.length) {
      const current = pending.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      pending.push(...(adjacency.get(current) ?? []));
    }
    const unreachable = nodes.find((node) => !visited.has(node.id));
    if (unreachable) {
      throw new BadRequestException(`Workflow node ${unreachable.id} is unreachable from START`);
    }
    if (!nodes.some((node) => node.type === "END" && visited.has(node.id))) {
      throw new BadRequestException("Workflow graph has no reachable END node");
    }
  }

  private assertCyclesAllowed(nodes: WorkflowNodeDto[], edges: WorkflowEdgeDto[]): void {
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const adjacency = this.adjacency(edges);
    const state = new Map<string, 0 | 1 | 2>();
    const stack: string[] = [];

    const visit = (id: string): void => {
      state.set(id, 1);
      stack.push(id);
      for (const target of adjacency.get(id) ?? []) {
        if (state.get(target) === 1) {
          const cycle = stack.slice(stack.indexOf(target));
          if (!cycle.some((nodeId) => byId.get(nodeId)?.type === "LOOP")) {
            throw new BadRequestException("Workflow graph contains a cycle without a LOOP node");
          }
        } else if (!state.has(target)) {
          visit(target);
        }
      }
      stack.pop();
      state.set(id, 2);
    };

    for (const node of nodes) {
      if (!state.has(node.id)) visit(node.id);
    }
  }

  private adjacency(edges: WorkflowEdgeDto[]): Map<string, string[]> {
    const adjacency = new Map<string, string[]>();
    for (const edge of edges) {
      const values = adjacency.get(edge.sourceNodeId) ?? [];
      values.push(edge.targetNodeId);
      adjacency.set(edge.sourceNodeId, values);
    }
    return adjacency;
  }

  private unique(values: string[], label: string): void {
    if (new Set(values).size !== values.length) {
      throw new BadRequestException(`${label} must be unique`);
    }
  }
}
