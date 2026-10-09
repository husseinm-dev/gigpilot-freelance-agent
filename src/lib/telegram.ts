import { env } from "@/lib/env";

/**
 * Minimal Telegram Bot API client. Secrets stay in env vars and are never
 * included in message bodies.
 */
export async function sendTelegram(
  text: string,
  opts?: { disablePreview?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  const token = env().TELEGRAM_BOT_TOKEN;
  const chatId = env().TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return { ok: false, error: "Telegram not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)" };
  }

  // Defense in depth: refuse to send anything that looks like a secret.
  if (/sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN/.test(text)) {
    return { ok: false, error: "Message blocked: possible secret detected" };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, 4096),
        disable_web_page_preview: opts?.disablePreview ?? true,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Telegram HTTP ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface RunSummary {
  label: string;
  jobsDiscovered: number;
  qualified: number;
  proposalsGenerated: number;
  bidsSubmitted: number;
  awaitingApproval: number;
  readyForManual: number;
  runCostUsd: number;
  monthlyCostUsd: number;
  dashboardUrl?: string;
  dryRun?: boolean;
}

export function formatRunSummary(s: RunSummary): string {
  const lines = [
    `GIGPILOT — ${s.label.toUpperCase()}${s.dryRun ? " (DRY RUN)" : ""}`,
    "",
    `Jobs discovered: ${s.jobsDiscovered}`,
    `Qualified opportunities: ${s.qualified}`,
    `Proposals generated: ${s.proposalsGenerated}`,
    `Bids submitted: ${s.bidsSubmitted}`,
    `Awaiting approval: ${s.awaitingApproval}`,
  ];
  if (s.readyForManual > 0) lines.push(`Ready for manual submission: ${s.readyForManual}`);
  lines.push(
    `AI cost: $${s.runCostUsd.toFixed(4)}`,
    `Monthly AI spending: $${s.monthlyCostUsd.toFixed(2)}`,
  );
  if (s.dashboardUrl) {
    lines.push("", `Dashboard: ${s.dashboardUrl}`);
    if (s.awaitingApproval > 0) lines.push(`Approvals: ${s.dashboardUrl}/approvals`);
  }
  return lines.join("\n");
}
