import type { WorkflowNodeType } from "@prisma/client";

export type WorkflowRuntimeNode = {
  id: string; type: WorkflowNodeType; name?: string; referenceId?: string;
  configuration?: Record<string, unknown>; metadata?: Record<string, unknown>; sortOrder?: number;
};
export type WorkflowRuntimeEdge = {
  id: string; sourceNodeId: string; targetNodeId: string; label?: string;
  metadata?: Record<string, unknown>; sortOrder?: number;
};
export type WorkflowRuntimeBranch = {
  nodeId: string; key: string; targetNodeId: string; condition: Record<string, unknown>;
};
export type WorkflowRuntimeVariable = {
  name: string; schema: Record<string, unknown>; required?: boolean; defaultValue?: unknown;
};
export type WorkflowRuntimeSnapshot = {
  name: string; slug: string; variables: WorkflowRuntimeVariable[];
  inputs: Array<{ name: string; schema: Record<string, unknown>; required?: boolean }>;
  outputs: Array<{ name: string; schema: Record<string, unknown> }>;
  nodes: WorkflowRuntimeNode[]; edges: WorkflowRuntimeEdge[]; branches: WorkflowRuntimeBranch[];
  metadata?: Record<string, unknown>;
};
export type WorkflowExecutionContext = {
  input: Record<string, unknown>; globals: Record<string, unknown>;
  nodes: Record<string, unknown>; output: Record<string, unknown>;
  metadata: Record<string, unknown>;
};
