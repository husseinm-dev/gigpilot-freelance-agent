import { describe, it, expect } from "vitest";
import { cleanText, contentHash, normalizeJob, dedupeBatch, type NormalizedJob } from "@/lib/normalize";

function makeJob(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    sourceKey: "manual",
    externalId: "1",
    title: "Build a Next.js site",
    description: "We need a marketing site built with Next.js and Tailwind CSS. ".repeat(3),
    skillsRequired: ["Next.js", "tailwind"],
    ...overrides,
  };
}

describe("cleanText", () => {
  it("strips HTML and collapses whitespace", () => {
    expect(cleanText("<p>Hello   <b>world</b></p>\n\n  test")).toBe("Hello world test");
  });

  it("decodes common entities", () => {
    expect(cleanText("Design &amp; build &quot;fast&quot;")).toBe('Design & build "fast"');
  });
});

describe("contentHash", () => {
  it("is identical for same content with different markup/casing", () => {
    const a = contentHash("Build a WEBSITE", "<p>Need React dev!</p>");
    const b = contentHash("build a website", "Need   React dev!");
    expect(a).toBe(b);
  });

  it("differs for different content", () => {
    expect(contentHash("Job A", "desc one")).not.toBe(contentHash("Job B", "desc two"));
  });
});

describe("normalizeJob", () => {
  it("lowercases and dedupes skills", () => {
    const job = normalizeJob(makeJob({ skillsRequired: ["React", "react", " REACT ", "Vue"] }));
    expect(job.skillsRequired).toEqual(["react", "vue"]);
  });

  it("truncates long fields and defaults currency", () => {
    const job = normalizeJob(makeJob({ title: "x".repeat(600), currency: undefined }));
    expect(job.title.length).toBeLessThanOrEqual(500);
    expect(job.currency).toBe("USD");
  });
});

describe("dedupeBatch", () => {
  it("removes same-source duplicates by external id", () => {
    const jobs = [makeJob(), makeJob({ description: "Totally different description that is long enough." })];
    expect(dedupeBatch(jobs)).toHaveLength(1);
  });

  it("removes cross-source duplicates by content hash", () => {
    const jobs = [
      makeJob({ sourceKey: "remoteok", externalId: "a" }),
      makeJob({ sourceKey: "remotive", externalId: "b" }),
    ];
    expect(dedupeBatch(jobs)).toHaveLength(1);
  });

  it("keeps distinct jobs", () => {
    const jobs = [
      makeJob({ externalId: "a" }),
      makeJob({ externalId: "b", title: "WordPress plugin work", description: "Custom WooCommerce plugin with REST API integration needed." }),
    ];
    expect(dedupeBatch(jobs)).toHaveLength(2);
  });
});
