import type { NormalizedJob } from "@/lib/normalize";

export type IntegrationStatus =
  | "working"
  | "requires_credentials"
  | "requires_approval"
  | "manual_only"
  | "unsupported";

/**
 * Honest capability report for every adapter. Capabilities must reflect
 * what has actually been implemented and verified — never aspirations.
 */
export interface SourceCapabilities {
  key: string;
  name: string;
  discoverySupported: boolean;
  authRequired: boolean;
  officialApi: boolean;
  submissionSupported: boolean;
  humanConfirmationRequired: boolean;
  tested: boolean;
  applicationCostModel: "free" | "credits" | "connects";
  integrationStatus: IntegrationStatus;
  limitations: string[];
}

export interface DiscoverOptions {
  maxJobs: number;
  keywords: string[];
  sourceConfig?: Record<string, unknown>;
}

export interface SubmitBidInput {
  externalJobId: string;
  coverLetter: string;
  bidAmountUsd?: number;
  estimatedDays?: number;
}

export interface SubmitBidResult {
  submitted: boolean;
  externalConfirmationId?: string;
  externalConfirmationUrl?: string;
  raw?: Record<string, unknown>;
  error?: string;
}

export interface SourceAdapter {
  capabilities(): SourceCapabilities;
  /** True when all credentials this adapter needs are present in env. */
  isConfigured(): boolean;
  /** Discover recent jobs. Must respect opts.maxJobs and rate limits. */
  discover(opts: DiscoverOptions): Promise<NormalizedJob[]>;
  /** Verify connectivity/credentials without side effects. */
  testConnection(): Promise<{ ok: boolean; message: string }>;
  /**
   * Submit a bid. Only callable when capabilities().submissionSupported
   * is true AND the platform permits unattended programmatic bidding.
   * Adapters that cannot submit must throw.
   */
  submitBid?(input: SubmitBidInput): Promise<SubmitBidResult>;
}
