import { z } from "zod";

/**
 * Server-side environment validation. Secrets only ever live here —
 * never in the database and never exposed to the browser.
 * Empty strings are treated as unset.
 */
const envObject = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_CHAT_ID: z.string().min(1).optional(),
  FREELANCER_OAUTH_TOKEN: z.string().min(1).optional(),
  UPWORK_ACCESS_TOKEN: z.string().min(1).optional(),
  UPWORK_CLIENT_ID: z.string().min(1).optional(),
  UPWORK_CLIENT_SECRET: z.string().min(1).optional(),
  UPWORK_REFRESH_TOKEN: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(16).optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD_HASH: z.string().min(1).optional(),
  DASHBOARD_URL: z.string().url().optional(),
  GIGPILOT_DRY_RUN: z.string().optional(),
  NODE_ENV: z.string().optional(),
});

export type Env = z.infer<typeof envObject>;

export function env(): Env {
  // Parsed on each call (cheap) so tests and runtime env changes are honored.
  const cleaned = Object.fromEntries(
    Object.entries(process.env).filter(([, v]) => v !== ""),
  );
  return envObject.parse(cleaned);
}

export function requireEnv<K extends keyof Env>(key: K): NonNullable<Env[K]> {
  const value = env()[key];
  if (!value) throw new Error(`Missing required environment variable: ${String(key)}`);
  return value as NonNullable<Env[K]>;
}

export function isDryRun(): boolean {
  return env().GIGPILOT_DRY_RUN === "1" || env().GIGPILOT_DRY_RUN === "true";
}
