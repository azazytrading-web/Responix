import { BadRequestException, Injectable } from "@nestjs/common";
import { ChannelMessageState } from "@prisma/client";

const transitions: Readonly<Record<ChannelMessageState, readonly ChannelMessageState[]>> = {
  UNKNOWN: ["QUEUED", "SENT", "DELIVERED", "READ", "FAILED", "DELETED"],
  QUEUED: ["PREPARING", "CANCELLED", "EXPIRED"],
  PREPARING: ["SENDING", "FAILED", "CANCELLED", "EXPIRED"],
  SENDING: ["SENT", "FAILED", "RETRIED", "CANCELLED"],
  RETRIED: ["PREPARING", "FAILED", "CANCELLED", "EXPIRED"],
  SENT: ["DELIVERED", "READ", "FAILED", "DELETED", "EXPIRED"],
  DELIVERED: ["READ", "FAILED", "DELETED", "EXPIRED"],
  READ: ["DELETED"],
  FAILED: ["RETRIED", "DELETED"],
  EXPIRED: ["DELETED"],
  CANCELLED: ["DELETED"],
  DELETED: []
};

@Injectable()
export class ChannelMessageStateMachine {
  assert(from: ChannelMessageState, to: ChannelMessageState): void {
    if (!transitions[from].includes(to)) {
      throw new BadRequestException(`Invalid channel message transition ${from} -> ${to}`);
    }
  }
  terminal(state: ChannelMessageState): boolean {
    return ["READ", "FAILED", "EXPIRED", "CANCELLED", "DELETED"].includes(state);
  }
}
