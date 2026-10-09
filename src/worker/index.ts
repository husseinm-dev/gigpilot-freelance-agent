import "dotenv/config";
import { hunt } from "./hunt";
import { isDryRun } from "@/lib/env";

const arg = process.argv[2] ?? "scheduled";
const dryRun = isDryRun() || arg === "dry-run";
const trigger = arg === "dry-run" ? "dry_run" : arg === "manual" ? "manual" : "scheduled";

hunt({ trigger, dryRun }).catch((err) => {
  console.error(err);
  process.exit(1);
});
