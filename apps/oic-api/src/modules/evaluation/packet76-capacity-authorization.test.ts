import assert from "node:assert/strict";
import test from "node:test";
import { canProvisionPacket76CapacityExtension } from "./evaluation.service";

void test("Packet 7.6 capacity extension accepts a Console manager through the fixed scoped authority path", () => {
  assert.equal(canProvisionPacket76CapacityExtension([
    "oic:console:manage",
    "oic:evaluation:read"
  ]), true);
});

void test("Packet 7.6 capacity extension accepts evaluation and admission managers", () => {
  assert.equal(canProvisionPacket76CapacityExtension([
    "oic:evaluation:manage",
    "oic:admission:manage"
  ]), true);
});

void test("Packet 7.6 capacity extension accepts the existing Foundation admin delegation semantics", () => {
  assert.equal(canProvisionPacket76CapacityExtension([
    "oic:foundation:admin",
    "oic:admission:manage"
  ]), true);
  assert.equal(canProvisionPacket76CapacityExtension(["oic:foundation:admin"]), true);
});

void test("evaluation-only runner or publisher cannot provision supplemental capacity", () => {
  assert.equal(canProvisionPacket76CapacityExtension(["oic:evaluation:manage"]), false);
  assert.equal(canProvisionPacket76CapacityExtension([
    "oic:evaluation:manage",
    "oic:evaluation:holdout:import"
  ]), false);
});

void test("admission-only or read-only principals cannot provision supplemental capacity", () => {
  assert.equal(canProvisionPacket76CapacityExtension(["oic:admission:manage"]), false);
  assert.equal(canProvisionPacket76CapacityExtension(["oic:evaluation:read"]), false);
  assert.equal(canProvisionPacket76CapacityExtension([]), false);
});
