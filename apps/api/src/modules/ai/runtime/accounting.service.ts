import { Injectable } from "@nestjs/common";
import { RuntimeProtectionRepository } from "./runtime-protection.repository";
import type {
  RuntimeFailureAccounting
} from "./runtime.types";

@Injectable()
export class AccountingService {
  constructor(private readonly repository: RuntimeProtectionRepository) {}

  recordFailure(input: RuntimeFailureAccounting): Promise<void> {
    return this.repository.recordFailure(input);
  }
}
