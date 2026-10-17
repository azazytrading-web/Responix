export function domainCoverageRows(packs: unknown, releases: unknown): Array<{
  key: string;
  domains: string[];
  packRevisionCount: number;
  caseCount: number;
  publishedReleaseCount: number;
  status: "PUBLISHED" | "COMPROMISED" | "VALIDATED" | "DRAFT" | "MISSING";
}>;
