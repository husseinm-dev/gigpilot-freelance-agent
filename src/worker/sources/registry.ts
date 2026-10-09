import type { SourceAdapter } from "./types";
import { FreelancerAdapter } from "./freelancer";
import { RemoteOkAdapter } from "./remoteok";
import { RemotiveAdapter } from "./remotive";
import { RssAdapter } from "./rss";
import { UpworkAdapter } from "./upwork";
import { ManualImportAdapter } from "./manual";

/**
 * Every adapter GigPilot knows about. Capability reports are honest:
 * manual-only platforms never pretend to have APIs, and Upwork never
 * pretends to support unattended submission.
 */
export function allAdapters(): SourceAdapter[] {
  return [
    new UpworkAdapter(),
    new FreelancerAdapter(),
    new RemoteOkAdapter(),
    new RemotiveAdapter(),
    new RssAdapter("weworkremotely", "We Work Remotely (RSS)", [
      "https://weworkremotely.com/categories/remote-programming-jobs.rss",
      "https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss",
    ]),
    new RssAdapter("rss", "Custom RSS feeds", []),
    new ManualImportAdapter("contra", "Contra"),
    new ManualImportAdapter("peopleperhour", "PeoplePerHour"),
    new ManualImportAdapter("guru", "Guru"),
    new ManualImportAdapter("truelancer", "Truelancer"),
    new ManualImportAdapter("workana", "Workana"),
    new ManualImportAdapter("email", "Email job alerts", [
      "Forward authorized job alert emails and paste the listing via dashboard import",
    ]),
    new ManualImportAdapter("manual", "Manual URL / CSV import"),
  ];
}

export function adapterByKey(key: string): SourceAdapter | undefined {
  return allAdapters().find((a) => a.capabilities().key === key);
}
