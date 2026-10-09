import { db, schema } from "@/db/client";

type Level = "debug" | "info" | "warn" | "error";

export class RunLogger {
  constructor(private runId?: string) {}

  setRunId(runId: string) {
    this.runId = runId;
  }

  private async write(level: Level, worker: string | undefined, message: string, data?: Record<string, unknown>) {
    const line = `[${new Date().toISOString()}] [${level.toUpperCase()}]${worker ? ` [${worker}]` : ""} ${message}`;
    if (level === "error") console.error(line, data ?? "");
    else console.log(line, data ? JSON.stringify(data) : "");
    try {
      await db.insert(schema.automationEvents).values({
        runId: this.runId,
        level,
        worker,
        message,
        data,
      });
    } catch {
      // Logging must never crash the run.
    }
  }

  info = (msg: string, opts?: { worker?: string; data?: Record<string, unknown> }) =>
    this.write("info", opts?.worker, msg, opts?.data);
  warn = (msg: string, opts?: { worker?: string; data?: Record<string, unknown> }) =>
    this.write("warn", opts?.worker, msg, opts?.data);
  error = (msg: string, opts?: { worker?: string; data?: Record<string, unknown> }) =>
    this.write("error", opts?.worker, msg, opts?.data);
}
