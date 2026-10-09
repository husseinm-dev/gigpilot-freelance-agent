import "dotenv/config";
import { allAdapters } from "./sources/registry";
import { env } from "@/lib/env";
import { sendTelegram } from "@/lib/telegram";
import { sql } from "@/db/client";

/**
 * npm run agent:test-integrations
 * Verifies every integration honestly: DB, OpenAI key presence, Telegram,
 * and each source adapter's connectivity. No bids, no AI spend.
 */
async function main() {
  console.log("GigPilot integration test\n" + "=".repeat(50));

  // Database
  try {
    await sql`SELECT 1`;
    console.log("✅ Database: connected");
  } catch (err) {
    console.log(`❌ Database: ${err instanceof Error ? err.message : err}`);
  }

  // OpenAI (presence only — no paid call)
  console.log(env().OPENAI_API_KEY ? "✅ OpenAI: API key configured" : "❌ OpenAI: OPENAI_API_KEY not set");

  // Telegram
  if (env().TELEGRAM_BOT_TOKEN && env().TELEGRAM_CHAT_ID) {
    const result = await sendTelegram("GigPilot integration test — Telegram OK ✅");
    console.log(result.ok ? "✅ Telegram: message sent" : `❌ Telegram: ${result.error}`);
  } else {
    console.log("⚠️ Telegram: not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)");
  }

  // Source adapters
  console.log("\nSource adapters:");
  for (const adapter of allAdapters()) {
    const caps = adapter.capabilities();
    if (!caps.discoverySupported && caps.integrationStatus === "manual_only") {
      console.log(`  ⏭  ${caps.name}: MANUAL_ONLY`);
      continue;
    }
    const test = await adapter.testConnection();
    const icon = test.ok ? "✅" : caps.authRequired && !adapter.isConfigured() ? "🔒" : "❌";
    console.log(`  ${icon} ${caps.name} [${caps.integrationStatus.toUpperCase()}]: ${test.message}`);
  }

  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
