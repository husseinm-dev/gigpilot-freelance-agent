import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { env } from "@/lib/env";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { db, schema } from "@/db/client";

// Simple fixed-window rate limiter (single-instance dashboard).
const attempts = new Map<string, { count: number; windowStart: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    attempts.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const adminEmail = env().ADMIN_EMAIL;
  const adminHash = env().ADMIN_PASSWORD_HASH;

  if (!adminEmail || !adminHash) {
    return NextResponse.json(
      { error: "Auth not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD_HASH." },
      { status: 500 },
    );
  }

  const emailOk = email.toLowerCase() === adminEmail.toLowerCase();
  const passwordOk = await bcrypt.compare(password, adminHash);

  if (!emailOk || !passwordOk) {
    await db.insert(schema.auditLogs).values({
      actor: email,
      action: "login_failed",
      ipAddress: ip,
    }).catch(() => {});
    // Generic error — don't reveal which field failed.
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await createSessionToken({ email });
  await setSessionCookie(token);

  await db.insert(schema.auditLogs).values({
    actor: email,
    action: "login_success",
    ipAddress: ip,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
