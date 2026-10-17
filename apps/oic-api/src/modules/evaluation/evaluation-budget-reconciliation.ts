import { createHash } from "node:crypto";
import { ConflictException } from "@nestjs/common";
import { Prisma } from "@oic/database";

export type BudgetReconciliationAdmission = {
  id: string;
  status: string;
  capacityExtensionId: string | null;
  legs: Array<{ bucketId: string; amount: Prisma.Decimal; state: string; budgetRevisionId: string | null; bucket: { unit: string } }>;
  postings: Array<{ kind: string; amount: Prisma.Decimal; bucketId: string }>;
};

export function computeBudgetLedgerAggregate(admissions: readonly BudgetReconciliationAdmission[]) {
  const ids = new Set<string>();
  let reserved = new Prisma.Decimal(0);
  let released = new Prisma.Decimal(0);
  let consumed = new Prisma.Decimal(0);
  const byFunding = new Map<string, { revisionIds: Set<string>; reserved: Prisma.Decimal; released: Prisma.Decimal; consumed: Prisma.Decimal; admissions: number }>();
  const basis: unknown[] = [];

  for (const admission of [...admissions].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!admission.id || ids.has(admission.id)) throw new ConflictException("OIC6_BUDGET_LEDGER_DUPLICATE_ADMISSION");
    ids.add(admission.id);
    if (admission.status !== "SETTLED" && admission.status !== "RELEASED") throw new ConflictException("OIC6_BUDGET_LEDGER_ADMISSION_NOT_TERMINAL");
    const legs = admission.legs.filter((leg) => leg.bucket.unit === "OIU" && leg.budgetRevisionId !== null);
    if (legs.length !== 1) throw new ConflictException("OIC6_BUDGET_LEDGER_BUDGET_LEG_INVALID");
    const leg = legs[0]!;
    if (!leg.amount.isFinite() || !leg.amount.gt(0) || !["SETTLED", "RELEASED"].includes(leg.state)) throw new ConflictException("OIC6_BUDGET_LEDGER_BUDGET_LEG_INVALID");
    const matching = admission.postings.filter((posting) => posting.bucketId === leg.bucketId);
    const sum = (kind: string) => matching.filter((posting) => posting.kind === kind).reduce((total, posting) => total.plus(posting.amount), new Prisma.Decimal(0));
    const reserve = sum("RESERVE");
    const release = sum("RELEASE");
    const use = sum("CONSUME");
    if (!reserve.equals(leg.amount) || release.lt(0) || use.lt(0) || !release.plus(use).equals(reserve)
      || (admission.status === "RELEASED" && !use.isZero())
      || (admission.status === "SETTLED" && !leg.amount.equals(release.plus(use)))) throw new ConflictException("OIC6_BUDGET_LEDGER_POSTINGS_INCONSISTENT");
    reserved = reserved.plus(reserve);
    released = released.plus(release);
    consumed = consumed.plus(use);
    const source = admission.capacityExtensionId ? `SUPPLEMENT:${admission.capacityExtensionId}` : "BASE";
    const group = byFunding.get(source) ?? { revisionIds: new Set<string>(), reserved: new Prisma.Decimal(0), released: new Prisma.Decimal(0), consumed: new Prisma.Decimal(0), admissions: 0 };
    group.revisionIds.add(leg.budgetRevisionId!);
    group.reserved = group.reserved.plus(reserve);
    group.released = group.released.plus(release);
    group.consumed = group.consumed.plus(use);
    group.admissions += 1;
    byFunding.set(source, group);
    basis.push({ id: admission.id, status: admission.status, capacityExtensionId: admission.capacityExtensionId, budgetRevisionId: leg.budgetRevisionId, leg: { state: leg.state, amount: leg.amount.toString() }, postings: matching.map((posting) => ({ kind: posting.kind, amount: posting.amount.toString() })).sort((a, b) => `${a.kind}:${a.amount}`.localeCompare(`${b.kind}:${b.amount}`)) });
  }
  if (!reserved.equals(released.plus(consumed))) throw new ConflictException("OIC6_BUDGET_LEDGER_TOTALS_INCONSISTENT");
  const funding = Object.fromEntries([...byFunding.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([source, value]) => [source, {
    admissionCount: value.admissions,
    budgetRevisionIds: [...value.revisionIds].sort(),
    reservedOiu: value.reserved.toString(),
    releasedOiu: value.released.toString(),
    consumedOiu: value.consumed.toString()
  }]));
  return {
    admissionCount: ids.size,
    reservedOiu: reserved.toString(),
    releasedOiu: released.toString(),
    consumedOiu: consumed.toString(),
    funding,
    ledgerBasisDigest: createHash("sha256").update(JSON.stringify(basis)).digest("hex")
  };
}
