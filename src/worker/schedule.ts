/**
 * DST-aware scheduling helpers. Target run times are 9:00 AM and 6:00 PM
 * America/New_York. GitHub Actions cron is UTC-only, so the workflow fires
 * at both possible UTC offsets (EST/EDT) and this guard decides whether the
 * current moment actually falls inside a valid local window. The slot key
 * (e.g. "2025-10-08-morning") is unique in the DB, so a delayed or duplicate
 * trigger can never cause double work.
 */

const TZ = "America/New_York";

export interface SlotInfo {
  slotKey: string;
  label: "morning" | "evening";
}

export function nyParts(date: Date): { ymd: string; hour: number; minute: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    ymd: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour === "24" ? "0" : parts.hour),
    minute: Number(parts.minute),
  };
}

/**
 * Returns the slot this moment belongs to, or null if outside both windows.
 * Windows are generous (slot hour .. +3h59m) because GitHub Actions cron can
 * be delayed substantially; the unique slot key prevents duplicates.
 */
export function currentSlot(now = new Date()): SlotInfo | null {
  const { ymd, hour } = nyParts(now);
  if (hour >= 9 && hour < 13) return { slotKey: `${ymd}-morning`, label: "morning" };
  if (hour >= 18 && hour < 22) return { slotKey: `${ymd}-evening`, label: "evening" };
  return null;
}

/** Manual runs get a unique timestamped key so they never collide. */
export function manualSlotKey(now = new Date()): string {
  return `manual-${now.toISOString()}`;
}
