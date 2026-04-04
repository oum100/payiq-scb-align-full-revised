import { setTimeout as sleep } from "node:timers/promises";
import { spawn } from "node:child_process";

const INTERVAL_MS = 60_000;

async function runOnce() {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(
      "bun",
      ["run", "scripts/reconcile-pending.ts"],
      {
        stdio: "inherit",
      },
    );

    proc.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`reconcile-pending failed with code ${code}`));
    });
  });
}

async function main() {
  console.log("[reconcile-scheduler] started");

  while (true) {
    try {
      console.log("[reconcile-scheduler] tick");
      await runOnce();
    } catch (err) {
      console.error("[reconcile-scheduler] error", err);
    }

    await sleep(INTERVAL_MS);
  }
}

main().catch((err) => {
  console.error("[reconcile-scheduler] fatal", err);
  process.exit(1);
});