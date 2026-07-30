import { BadRequestException, Injectable } from "@nestjs/common";
import { StreamSessionStatus } from "@prisma/client";
const transitions: Readonly<Record<StreamSessionStatus, readonly StreamSessionStatus[]>> = {
  PENDING: ["CONNECTING", "CANCELLED", "FAILED", "TIMED_OUT"], CONNECTING: ["STREAMING", "CANCELLED", "FAILED", "TIMED_OUT", "DISCONNECTED"],
  STREAMING: ["PAUSED", "COMPLETED", "CANCELLED", "FAILED", "TIMED_OUT", "DISCONNECTED"], PAUSED: ["STREAMING", "CANCELLED", "FAILED", "TIMED_OUT", "DISCONNECTED"],
  COMPLETED: [], CANCELLED: [], FAILED: [], TIMED_OUT: [], DISCONNECTED: []
};
@Injectable() export class StreamStateMachine { assert(from: StreamSessionStatus, to: StreamSessionStatus) { if (!transitions[from].includes(to)) throw new BadRequestException(`Invalid stream state transition: ${from} -> ${to}`); } }
