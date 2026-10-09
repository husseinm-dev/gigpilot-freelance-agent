import { describe, it, expect } from "vitest";
import {
  deterministicFilter,
  techMatchScore,
  budgetScore,
  recencyScore,
  clientScore,
  type FilterableJob,
} from "@/worker/workers/deterministic-filter";
import { DEFAULT_SETTINGS } from "@/lib/settings-schema";
import { DEFAULT_SKILLS, type ProfileContext } from "@/lib/profile-context";

const profile: ProfileContext = {
  businessName: "Your Business",
  website: "https://example.com",
  yearsOfExperience: 8,
  minimumProjectPriceUsd: 300,
  services: [],
  preferredIndustries: ["healthcare"],
  excludedIndustries: ["gambling"],
  skills: DEFAULT_SKILLS,
  portfolio: [],
};

function job(overrides: Partial<FilterableJob> = {}): FilterableJob {
  return {
    title: "Build a React + Next.js marketing website",
    description:
      "We need an experienced developer to build a responsive marketing website with Next.js, TypeScript and Tailwind CSS. Clear scope: 6 pages, CMS integration, contact forms. Design is ready in Figma.",
    skillsRequired: ["react", "next.js", "typescript"],
    budgetMinUsd: 800,
    budgetMaxUsd: 1500,
    postedAt: new Date(Date.now() - 2 * 3600 * 1000),
    ...overrides,
  };
}

describe("techMatchScore", () => {
  it("scores high for strong matches", () => {
    expect(techMatchScore(job(), profile)).toBeGreaterThanOrEqual(80);
  });

  it("scores low for unrelated work", () => {
    const j = job({
      title: "Unity 3D game art",
      description: "Need character modeling and animation for our mobile game project built in a game engine.",
      skillsRequired: ["unity", "blender"],
    });
    expect(techMatchScore(j, profile)).toBeLessThan(34);
  });
});

describe("budgetScore", () => {
  it("rejects budgets below the minimum", () => {
    expect(budgetScore(job({ budgetMinUsd: 50, budgetMaxUsd: 150 }), DEFAULT_SETTINGS)).toBe(0);
  });

  it("gives full score inside preferred range", () => {
    expect(budgetScore(job({ budgetMinUsd: 800, budgetMaxUsd: 1500 }), DEFAULT_SETTINGS)).toBe(100);
  });

  it("is neutral when budget unknown", () => {
    expect(budgetScore(job({ budgetMinUsd: undefined, budgetMaxUsd: undefined }), DEFAULT_SETTINGS)).toBe(50);
  });
});

describe("recencyScore", () => {
  it("zeroes out stale jobs", () => {
    const stale = job({ postedAt: new Date(Date.now() - 100 * 3600 * 1000) });
    expect(recencyScore(stale, DEFAULT_SETTINGS)).toBe(0);
  });

  it("scores fresh jobs high", () => {
    expect(recencyScore(job(), DEFAULT_SETTINGS)).toBeGreaterThan(90);
  });
});

describe("clientScore", () => {
  it("rewards verified high-rated clients", () => {
    const good = clientScore(job({ clientVerified: true, clientRating: 4.9, bidCount: 3 }));
    const unknown = clientScore(job());
    expect(good).toBeGreaterThan(unknown);
  });

  it("never fabricates — unknown client data stays neutral", () => {
    expect(clientScore(job())).toBe(50);
  });
});

describe("deterministicFilter", () => {
  it("passes a strong matching job", () => {
    const result = deterministicFilter(job(), profile, DEFAULT_SETTINGS);
    expect(result.passed).toBe(true);
    expect(result.rejectionReasons).toHaveLength(0);
  });

  it("rejects scam patterns", () => {
    const scam = job({
      description:
        "Great opportunity! You just need to pay a registration fee first and then earn $500 per day guaranteed working from home on our platform.",
    });
    const result = deterministicFilter(scam, profile, DEFAULT_SETTINGS);
    expect(result.passed).toBe(false);
    expect(result.rejectionReasons.join(" ")).toMatch(/scam/i);
  });

  it("rejects unpaid test work", () => {
    const unpaid = job({
      description:
        "Before hiring we require an unpaid test task to evaluate your React skills. The real project is a Next.js dashboard.",
    });
    expect(deterministicFilter(unpaid, profile, DEFAULT_SETTINGS).passed).toBe(false);
  });

  it("rejects skills outside the profile", () => {
    const wrong = job({
      title: "Solidity smart contract audit",
      description:
        "We need a blockchain developer to audit our smart contract and build solidity contracts for our token sale platform launch.",
      skillsRequired: ["solidity"],
    });
    const result = deterministicFilter(wrong, profile, DEFAULT_SETTINGS);
    expect(result.passed).toBe(false);
    expect(result.rejectionReasons.join(" ")).toMatch(/outside profile/);
  });

  it("rejects excluded industries", () => {
    const excluded = job({
      description:
        "Build a gambling affiliate site with React and Next.js. Clear requirements, good budget, design provided in Figma files.",
    });
    const result = deterministicFilter(excluded, profile, DEFAULT_SETTINGS);
    expect(result.passed).toBe(false);
    expect(result.rejectionReasons.join(" ")).toMatch(/Excluded industry/);
  });

  it("rejects vague descriptions", () => {
    const vague = job({ description: "need website asap" });
    const result = deterministicFilter(vague, profile, DEFAULT_SETTINGS);
    expect(result.passed).toBe(false);
  });

  it("rejects budgets below minimum", () => {
    const cheap = job({ budgetMinUsd: 100, budgetMaxUsd: 200 });
    const result = deterministicFilter(cheap, profile, DEFAULT_SETTINGS);
    expect(result.passed).toBe(false);
    expect(result.rejectionReasons.join(" ")).toMatch(/below minimum/);
  });
});
