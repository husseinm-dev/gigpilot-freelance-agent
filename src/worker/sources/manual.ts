import type { NormalizedJob } from "@/lib/normalize";
import type { SourceAdapter, SourceCapabilities, DiscoverOptions } from "./types";

/**
 * Manual import pseudo-adapter for platforms without usable APIs:
 * Contra, PeoplePerHour, Guru, Truelancer, Workana, email alerts, etc.
 * Jobs enter via the dashboard (paste URL + description, or CSV upload).
 * discover() always returns [] — rows are inserted by the import API route.
 */
export class ManualImportAdapter implements SourceAdapter {
  constructor(
    private key: string,
    private name: string,
    private extraLimitations: string[] = [],
  ) {}

  capabilities(): SourceCapabilities {
    return {
      key: this.key,
      name: this.name,
      discoverySupported: false,
      authRequired: false,
      officialApi: false,
      submissionSupported: false,
      humanConfirmationRequired: true,
      tested: false,
      applicationCostModel: "free",
      integrationStatus: "manual_only",
      limitations: [
        "No public API suitable for automated discovery — import jobs via dashboard (URL or CSV)",
        "Qualification, proposal generation, and approval workflow still fully apply",
        ...this.extraLimitations,
      ],
    };
  }

  isConfigured(): boolean {
    return true;
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    return { ok: true, message: "Manual import — nothing to test" };
  }

  async discover(opts: DiscoverOptions): Promise<NormalizedJob[]> {
    void opts;
    return [];
  }
}
