import { describe, it, expect } from "vitest";
import { currentSlot, manualSlotKey, nyParts } from "@/worker/schedule";

describe("DST-aware scheduling", () => {
  it("maps 13:00 UTC in July (EDT) to the morning slot", () => {
    // July 15 2025, 13:00 UTC = 9:00 AM EDT
    const slot = currentSlot(new Date("2025-07-15T13:05:00Z"));
    expect(slot).toEqual({ slotKey: "2025-07-15-morning", label: "morning" });
  });

  it("maps 14:00 UTC in January (EST) to the morning slot", () => {
    // Jan 15 2025, 14:00 UTC = 9:00 AM EST
    const slot = currentSlot(new Date("2025-01-15T14:05:00Z"));
    expect(slot).toEqual({ slotKey: "2025-01-15-morning", label: "morning" });
  });

  it("gives the SAME slot key for both cron triggers on an EDT day (idempotent)", () => {
    const first = currentSlot(new Date("2025-07-15T13:01:00Z")); // 9:01 EDT
    const second = currentSlot(new Date("2025-07-15T14:01:00Z")); // 10:01 EDT — delayed/duplicate trigger
    expect(first?.slotKey).toBe(second?.slotKey);
  });

  it("maps 22:00 UTC in July to the evening slot", () => {
    const slot = currentSlot(new Date("2025-07-15T22:10:00Z")); // 6:10 PM EDT
    expect(slot).toEqual({ slotKey: "2025-07-15-evening", label: "evening" });
  });

  it("maps 23:00 UTC in January to the evening slot", () => {
    const slot = currentSlot(new Date("2025-01-15T23:10:00Z")); // 6:10 PM EST
    expect(slot).toEqual({ slotKey: "2025-01-15-evening", label: "evening" });
  });

  it("returns null outside run windows", () => {
    expect(currentSlot(new Date("2025-07-15T07:00:00Z"))).toBeNull(); // 3 AM EDT
    expect(currentSlot(new Date("2025-01-15T19:30:00Z"))).toBeNull(); // 2:30 PM EST
  });

  it("tolerates GitHub Actions delays within the window", () => {
    // Scheduled 9 AM, actually started 11:45 AM ET — still same slot
    const delayed = currentSlot(new Date("2025-07-15T15:45:00Z"));
    expect(delayed?.slotKey).toBe("2025-07-15-morning");
  });

  it("handles the evening slot crossing UTC midnight in winter", () => {
    // Jan 15, 23:30 UTC = 6:30 PM EST — slot date must be the NY date (Jan 15)
    const slot = currentSlot(new Date("2025-01-15T23:30:00Z"));
    expect(slot?.slotKey).toBe("2025-01-15-evening");
  });

  it("produces unique manual slot keys", () => {
    const a = manualSlotKey(new Date("2025-07-15T13:00:00Z"));
    const b = manualSlotKey(new Date("2025-07-15T13:00:01Z"));
    expect(a).not.toBe(b);
  });

  it("computes NY local parts correctly across DST boundary", () => {
    expect(nyParts(new Date("2025-03-09T06:59:00Z")).hour).toBe(1); // EST before spring-forward
    expect(nyParts(new Date("2025-03-09T07:01:00Z")).hour).toBe(3); // EDT after
  });
});
