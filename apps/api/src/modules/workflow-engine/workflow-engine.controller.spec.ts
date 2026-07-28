import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  CreateWorkflowDto,
  RollbackWorkflowDto,
  WorkflowListQueryDto
} from "./dto/workflow-engine.dto";
import { WorkflowEngineController } from "./workflow-engine.controller";

describe("WorkflowEngineController validation and permissions", () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });

  it("accepts complete topology and workflow metadata", async () => {
    await expect(pipe.transform({
      name: "Lead Routing", slug: "lead-routing", visibility: "WORKSPACE",
      triggerType: "MANUAL", metadata: { owner: "sales" },
      variables: [{ name: "score", schema: { type: "number" }, defaultValue: 0 }],
      parameters: [{ name: "region", schema: { type: "string" }, required: true }],
      inputs: [{ name: "lead", schema: { type: "object" }, required: true }],
      outputs: [{ name: "result", schema: { type: "object" } }],
      nodes: [
        { id: "start", type: "START", position: { x: 0, y: 0 } },
        { id: "route", type: "DECISION", configuration: { mode: "first-match" } },
        { id: "end", type: "END" }
      ],
      edges: [
        { id: "start-route", sourceNodeId: "start", targetNodeId: "route" },
        { id: "route-end", sourceNodeId: "route", targetNodeId: "end" }
      ],
      conditions: [{ key: "qualified", edgeId: "route-end", expression: { op: "gte", value: 70 } }],
      branches: [{ nodeId: "route", key: "qualified", targetNodeId: "end", condition: { value: true } }],
      labels: [{ name: "Sales", color: "#3366FF" }],
      notes: [{ content: "Reviewed topology" }],
      permissions: [{ permissionCode: "crm.view" }]
    }, { type: "body", metatype: CreateWorkflowDto })).resolves.toBeInstanceOf(CreateWorkflowDto);
  });

  it.each([
    { name: "Bad", slug: "Bad Slug" },
    { name: "Bad", slug: "bad", visibility: "PUBLIC" },
    { name: "Bad", slug: "bad", nodes: [{ id: "bad id", type: "START" }] },
    { name: "Bad", slug: "bad", nodes: [{ id: "start", type: "UNKNOWN" }] },
    { name: "Bad", slug: "bad", edges: [{ id: "edge", sourceNodeId: "bad id", targetNodeId: "end" }] },
    { name: "Bad", slug: "bad", labels: [{ name: "X", color: "blue" }] },
    { name: "Bad", slug: "bad", unknown: true }
  ])("rejects invalid workflow DTO payload %#", async (payload) => {
    await expect(pipe.transform(payload, { type: "body", metatype: CreateWorkflowDto }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it("validates rollback revision and transforms list pagination", async () => {
    await expect(pipe.transform({ revision: 0 }, { type: "body", metatype: RollbackWorkflowDto }))
      .rejects.toBeInstanceOf(BadRequestException);
    const query = await pipe.transform(
      { page: "2", limit: "50", status: "PUBLISHED", sortBy: "name", sortOrder: "asc" },
      { type: "query", metatype: WorkflowListQueryDto }
    ) as WorkflowListQueryDto;
    expect(query).toMatchObject({ page: 2, limit: 50, status: "PUBLISHED", sortBy: "name", sortOrder: "asc" });
  });

  it("declares dedicated Workflow Engine permissions", () => {
    const reflector = new Reflector();
    /* eslint-disable @typescript-eslint/unbound-method */
    expect(reflector.get("permissions", WorkflowEngineController.prototype.list)).toEqual(["workflow.engine.read"]);
    expect(reflector.get("permissions", WorkflowEngineController.prototype.create)).toEqual(["workflow.engine.write"]);
    expect(reflector.get("permissions", WorkflowEngineController.prototype.publish)).toEqual(["workflow.engine.publish"]);
    expect(reflector.get("permissions", WorkflowEngineController.prototype.rollback)).toEqual(["workflow.engine.rollback"]);
    expect(reflector.get("permissions", WorkflowEngineController.prototype.archive)).toEqual(["workflow.engine.archive"]);
    expect(reflector.get("permissions", WorkflowEngineController.prototype.delete)).toEqual(["workflow.engine.delete"]);
    expect(reflector.get("permissions", WorkflowEngineController.prototype.createCategory)).toEqual(["workflow.engine.manage"]);
    /* eslint-enable @typescript-eslint/unbound-method */
  });
});
