import type { ProfileContext } from "@/lib/profile-context";
import type { AutomationSettings } from "@/lib/settings-schema";

export interface FilterableJob {
  title: string;
  description: string;
  skillsRequired: string[];
  budgetMinUsd?: number | null;
  budgetMaxUsd?: number | null;
  budgetType?: string | null;
  clientVerified?: boolean | null;
  clientRating?: number | null;
  bidCount?: number | null;
  applicationCostUsd?: number | null;
  postedAt?: Date | null;
}

export interface DeterministicScore {
  passed: boolean;
  deterministicScore: number;
  techMatchScore: number;
  budgetScore: number;
  recencyScore: number;
  clientScore: number;
  rejectionReasons: string[];
}

const SCAM_PATTERNS: RegExp[] = [
  /pay\s+(a|an?|the)?\s*(upfront|registration|training)\s*fee/i,
  /western\s*union|moneygram/i,
  /payment\s+outside\s+(the\s+)?platform/i,
  /send\s+(me\s+)?your\s+(bank|card)\s+details/i,
  /crypto(currency)?\s+(investment|trading)\s+(bot|platform)\s+guaranteed/i,
  /earn\s+\$\d+\s*(per|a)\s*(day|hour)\s+guaranteed/i,
  /telegram\s+only.*no\s+platform\s+communication/i,
  /free\s+(test\s+task|trial\s+(work|project))\s+(before|then)\s+(payment|hire)/i,
  /unpaid\s+(test|trial|sample)\s+(task|work|project)/i,
];

const UNREALISTIC_DEADLINE = /(within|in)\s+(24\s*hours?|1\s*day|2\s*days?)\s+.*\b(full|complete|entire)\b/i;

const EXCLUDED_SKILL_SIGNALS = [
  "unity", "unreal engine", "solidity", "blockchain developer", "smart contract",
  "flutter", "swiftui", "kotlin only", "embedded c", "fpga", "matlab",
  "autocad", "solidworks", "video editing", "3d modeling", "game development",
];

function normalize(text: string): string {
  return text.toLowerCase();
}

export function techMatchScore(job: FilterableJob, profile: ProfileContext): number {
  const haystack = normalize(
    `${job.title} ${job.description} ${job.skillsRequired.join(" ")}`,
  );
  const terms = profile.skills.flatMap((s) => [s.name.toLowerCase(), ...s.aliases.map((a) => a.toLowerCase())]);
  const matched = new Set<string>();
  for (const skill of profile.skills) {
    const all = [skill.name.toLowerCase(), ...skill.aliases.map((a) => a.toLowerCase())];
    if (all.some((t) => haystack.includes(t))) matched.add(skill.name);
  }
  if (terms.length === 0) return 0;
  // 3+ matched skills = full score; generic "website" work matches broadly
  return Math.min(100, Math.round((matched.size / 3) * 100));
}

export function budgetScore(job: FilterableJob, settings: AutomationSettings): number {
  const max = job.budgetMaxUsd ?? job.budgetMinUsd;
  const min = job.budgetMinUsd ?? job.budgetMaxUsd;
  if (max == null && min == null) return 50; // unknown budget — neutral, let AI judge
  const budget = max ?? min ?? 0;
  if (budget < settings.minBudgetUsd) return 0;
  if (budget >= settings.preferredBudgetMinUsd && budget <= settings.preferredBudgetMaxUsd) return 100;
  if (budget > settings.preferredBudgetMaxUsd) return 70; // large scope — possible but less preferred
  return 60; // between minimum and preferred floor
}

export function recencyScore(job: FilterableJob, settings: AutomationSettings, now = new Date()): number {
  if (!job.postedAt) return 40;
  const ageHours = (now.getTime() - job.postedAt.getTime()) / 36e5;
  if (ageHours < 0) return 40;
  if (ageHours > settings.maxJobAgeHours) return 0;
  return Math.round(100 * (1 - ageHours / settings.maxJobAgeHours));
}

export function clientScore(job: FilterableJob): number {
  let score = 50; // neutral when nothing known — never fabricate
  if (job.clientVerified === true) score += 25;
  if (job.clientVerified === false) score -= 10;
  if (job.clientRating != null) {
    score += job.clientRating >= 4.5 ? 25 : job.clientRating >= 4 ? 15 : job.clientRating < 3 ? -20 : 0;
  }
  if (job.bidCount != null) {
    score += job.bidCount <= 5 ? 10 : job.bidCount >= 40 ? -15 : 0;
  }
  return Math.max(0, Math.min(100, score));
}

/**
 * Deterministic pre-filter. Cheap, explainable, runs before any AI spend.
 * Hard-rejects scams, unpaid work, budget violations, and skill mismatches.
 */
export function deterministicFilter(
  job: FilterableJob,
  profile: ProfileContext,
  settings: AutomationSettings,
  now = new Date(),
): DeterministicScore {
  const reasons: string[] = [];
  const text = `${job.title} ${job.description}`;

  for (const pattern of SCAM_PATTERNS) {
    if (pattern.test(text)) {
      reasons.push("Matches a known scam/unpaid-work pattern");
      break;
    }
  }
  if (UNREALISTIC_DEADLINE.test(text)) {
    reasons.push("Unrealistic deadline for full project delivery");
  }

  const lowered = normalize(text + " " + job.skillsRequired.join(" "));
  const excludedHits = EXCLUDED_SKILL_SIGNALS.filter((s) => lowered.includes(s));
  if (excludedHits.length > 0) {
    reasons.push(`Requires skills outside profile: ${excludedHits.join(", ")}`);
  }

  for (const industry of profile.excludedIndustries) {
    if (industry && lowered.includes(industry.toLowerCase())) {
      reasons.push(`Excluded industry: ${industry}`);
    }
  }

  if (job.description.trim().length < 80) {
    reasons.push("Description too vague (<80 characters)");
  }

  const tech = techMatchScore(job, profile);
  const budget = budgetScore(job, settings);
  const recency = recencyScore(job, settings, now);
  const client = clientScore(job);

  if (budget === 0) {
    const max = job.budgetMaxUsd ?? job.budgetMinUsd;
    reasons.push(
      max != null && max < settings.minBudgetUsd
        ? `Budget $${max} below minimum $${settings.minBudgetUsd}`
        : "Listing too old",
    );
  }
  if (tech < 34) reasons.push("Insufficient technology match");
  if (recency === 0) reasons.push(`Older than ${settings.maxJobAgeHours}h limit`);

  // Weighted blend; free-to-apply boost applied by the caller if desired.
  const score = Math.round(tech * 0.4 + budget * 0.25 + recency * 0.2 + client * 0.15);

  return {
    passed: reasons.length === 0 && score >= settings.minDeterministicScore,
    deterministicScore: score,
    techMatchScore: tech,
    budgetScore: budget,
    recencyScore: recency,
    clientScore: client,
    rejectionReasons: reasons,
  };
}
