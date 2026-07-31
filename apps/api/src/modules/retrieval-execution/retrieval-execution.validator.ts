import { BadRequestException, Injectable } from "@nestjs/common";
import type { ExecuteRetrievalDto } from "./dto/retrieval-execution.dto";

@Injectable()
export class RetrievalExecutionValidator {
  normalizeQuery(value: string) {
    const normalized = value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("und");
    if (!normalized) throw new BadRequestException("Retrieval query must not be empty");
    return normalized;
  }
  validate(dto: ExecuteRetrievalDto) {
    const identities = (dto.filters ?? []).map((filter) => `${filter.key}:${filter.operator}`);
    if (new Set(identities).size !== identities.length) {
      throw new BadRequestException("Duplicate retrieval execution filters");
    }
    if ((dto.mode === "SEMANTIC" || dto.mode === "HYBRID") &&
      dto.providerCapabilities?.includes("retrieval.semantic") === false) {
      throw new BadRequestException("Selected provider is not compatible with semantic retrieval preparation");
    }
  }
  assertCompatibility(expected: string, actual = "1.0") {
    if (expected.split(".")[0] !== actual.split(".")[0]) {
      throw new BadRequestException("Retrieval execution compatibility version is not supported");
    }
  }
}
