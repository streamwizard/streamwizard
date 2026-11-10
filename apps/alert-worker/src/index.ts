import { env } from "@/lib/env";
import { buildRules } from "@repo/alerting/rules";
import { startWorker } from "@/worker";

// forTicks is counted in ticks, not seconds, so changing TICK_SECONDS changes
// every rule's debounce. Print the derived fire latency once at boot.
const latencies = buildRules()
  .map((rule) => `${rule.id}=${rule.forTicks * env.TICK_SECONDS}s`)
  .join(" ");
console.log(`[alert-worker] rule fire latency at this tick: ${latencies}`);

await startWorker();
