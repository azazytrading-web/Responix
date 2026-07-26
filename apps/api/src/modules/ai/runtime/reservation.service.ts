import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { AiContractError } from "../contracts";
import { RuntimeProtectionRepository } from "./runtime-protection.repository";
import type { RuntimeEstimate, RuntimeLimits, RuntimeReservation } from "./runtime.types";

@Injectable()
export class ReservationService {
  constructor(
    private readonly repository: RuntimeProtectionRepository,
    private readonly config: ConfigService
  ) {}

  async reserve(input: {
    workspaceId: string;
    requestId: string;
    estimate: RuntimeEstimate;
    limits: RuntimeLimits;
  }): Promise<RuntimeReservation> {
    const reservedAt = Date.now();
    const ttlMs = this.config.getOrThrow<number>("ai.runtime.reservationTtlMs");
    const ownerToken = randomUUID();
    const persisted = await this.repository.reserve({
      ...input,
      ownerToken,
      expiresAt: new Date(reservedAt + ttlMs),
      heartbeatTimeoutMs: ttlMs
    });
    const active =
      persisted.status === "ACTIVE"
        ? persisted
        : await this.waitForActivation(
            input.workspaceId,
            persisted.id,
            ownerToken,
            input.limits.maxConcurrentInvocations,
            ttlMs
          );
    const activatedAt = active.activatedAt;
    if (!activatedAt) {
      await this.repository.release(input.workspaceId, persisted.id, ownerToken);
      throw new AiContractError("RATE_LIMITED", "AI runtime reservation could not be activated");
    }
    return {
      id: active.id,
      workspaceId: active.workspaceId,
      requestId: active.requestId,
      ownerToken: active.ownerToken,
      status: "ACTIVE",
      estimate: {
        inputTokens: active.estimatedInputTokens,
        outputTokens: active.estimatedOutputTokens,
        totalTokens: active.estimatedTotalTokens,
        estimatedCost: active.estimatedCost
      },
      queuedAt: active.queuedAt,
      activatedAt,
      leaseExpiresAt: active.leaseExpiresAt,
      queueWaitMs: Math.max(0, activatedAt.getTime() - active.queuedAt.getTime()),
      reservedAt
    };
  }

  release(reservation: RuntimeReservation): Promise<void> {
    return this.repository.release(
      reservation.workspaceId,
      reservation.id,
      reservation.ownerToken
    );
  }

  async withLease<T>(
    reservation: RuntimeReservation,
    operation: (signal: AbortSignal) => Promise<T>
  ): Promise<T> {
    const ttlMs = this.config.getOrThrow<number>("ai.runtime.reservationTtlMs");
    const renewalIntervalMs = Math.max(1, Math.floor(ttlMs / 3));
    const controller = new AbortController();
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let rejectLease!: (error: unknown) => void;
    const leaseFailure = new Promise<never>((_resolve, reject) => {
      rejectLease = reject;
    });
    const renew = async (): Promise<void> => {
      try {
        const leaseExpiresAt = new Date(Date.now() + ttlMs);
        await this.repository.renewLease(
          reservation.workspaceId,
          reservation.id,
          reservation.ownerToken,
          leaseExpiresAt
        );
        reservation.leaseExpiresAt = leaseExpiresAt;
        if (!stopped) {
          timer = setTimeout(() => void renew(), renewalIntervalMs);
        }
      } catch (error: unknown) {
        controller.abort(error);
        rejectLease(error);
      }
    };

    await renew();
    let operationPromise: Promise<T> | undefined;
    try {
      operationPromise = operation(controller.signal);
      return await Promise.race([operationPromise, leaseFailure]);
    } catch (error: unknown) {
      controller.abort(error);
      if (operationPromise) {
        try {
          await operationPromise;
        } catch {
          // The original lease or provider failure remains authoritative.
        }
      }
      throw error;
    } finally {
      stopped = true;
      if (timer) clearTimeout(timer);
    }
  }

  private async waitForActivation(
    workspaceId: string,
    reservationId: string,
    ownerToken: string,
    maxConcurrentInvocations: number,
    ttlMs: number
  ) {
    const timeoutMs = this.config.getOrThrow<number>("ai.runtime.queueWaitTimeoutMs");
    const pollIntervalMs = this.config.getOrThrow<number>("ai.runtime.queuePollIntervalMs");
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const active = await this.repository.tryActivate(
        workspaceId,
        reservationId,
        ownerToken,
        maxConcurrentInvocations,
        new Date(Date.now() + ttlMs),
        ttlMs
      );
      if (active) return active;
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
    await this.repository.release(workspaceId, reservationId, ownerToken);
    throw new AiContractError("RATE_LIMITED", "AI runtime queue wait timed out");
  }
}
