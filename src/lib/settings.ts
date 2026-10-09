import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import {
  automationSettingsSchema,
  AutomationSettings,
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
} from "./settings-schema";

export async function getSettings(): Promise<AutomationSettings> {
  const row = await db.query.settings.findFirst({
    where: eq(schema.settings.key, SETTINGS_KEY),
  });
  if (!row) return DEFAULT_SETTINGS;
  const parsed = automationSettingsSchema.safeParse(row.value);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export async function saveSettings(partial: Partial<AutomationSettings>): Promise<AutomationSettings> {
  const current = await getSettings();
  const next = automationSettingsSchema.parse({ ...current, ...partial });
  await db
    .insert(schema.settings)
    .values({ key: SETTINGS_KEY, value: next, description: "Automation settings" })
    .onConflictDoUpdate({
      target: schema.settings.key,
      set: { value: next, updatedAt: new Date() },
    });
  return next;
}

export async function isPaused(): Promise<boolean> {
  return (await getSettings()).paused;
}

export async function setPaused(paused: boolean): Promise<void> {
  await saveSettings({ paused });
}
