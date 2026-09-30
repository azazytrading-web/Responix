import { Injectable } from "@nestjs/common";
import { Prisma } from "@oic/database";

export const OIC_FOUNDATION_AUDIT_WRITER = Symbol("OIC_FOUNDATION_AUDIT_WRITER");
export type FoundationAuditData = Prisma.OicAuditEventCreateArgs["data"];

export interface FoundationAuditWriter {
  write(tx: Prisma.TransactionClient, data: FoundationAuditData): Promise<unknown>;
}

@Injectable()
export class PrismaFoundationAuditWriter implements FoundationAuditWriter {
  write(tx: Prisma.TransactionClient, data: FoundationAuditData): Promise<unknown> {
    return tx.oicAuditEvent.create({ data });
  }
}
