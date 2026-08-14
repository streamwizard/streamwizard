import type { AlertRule, RuleOverrides } from "../types";
import { checkSslExpiry } from "../probes";
import type { Breach } from "../types";
import {
  NODE_SILENT_AFTER_MS,
  SSL_CRIT_DAYS,
  SSL_WARN_DAYS,
} from "./thresholds";
import {
  customRule,
  probeRule,
} from "./builders";

/** Synthetic probe rules. */
export function probeRules(overrides: RuleOverrides): AlertRule[] {
  return [
    // Probes
    probeRule(
      {
        id: "probe.fail",
        title: "Black-box probe failing",
        forTicks: 2,
        match: (id) => !id.startsWith("obs-node:") && !id.startsWith("ingest-node:"),
        severity: (_id, alertEnv) => (alertEnv === "prod" ? "crit" : "warn"),
      },
      overrides,
    ),
    probeRule(
      {
        id: "probe.node_unreachable",
        title: "Node health endpoint unreachable",
        // Deliberately slower than the *_silent absence rules (NODE_SILENT_AFTER_MS
        // = 45s): at 15s/tick this fires at 60s, after silence starts breaching,
        // so a fully-down node is caught by the crit silence path and the engine
        // suppresses this probe before it fires (see suppressRedundantNodeProbes).
        // A node that serves metrics but whose health endpoint is down still
        // fires here — just ~30s later than before.
        forTicks: 4,
        envs: ["prod", "staging"],
        match: (id) => id.startsWith("obs-node:") || id.startsWith("ingest-node:"),
        severity: () => "warn", // the *_silent absence rules own the crit path
      },
      overrides,
    ),
    customRule(
      {
        id: "probe.ssl_expiry",
        title: "TLS certificate expiring",
        forTicks: 1,
        envs: ["prod"],
        warn: { default: SSL_WARN_DAYS, unit: "days", direction: "below" },
        crit: { default: SSL_CRIT_DAYS, unit: "days", direction: "below" },
        async evaluate(ctx, t) {
          const certs = await checkSslExpiry(ctx.now);
          const breaches: Breach[] = [];
          for (const cert of certs) {
            if (cert.daysRemaining >= t.warn) continue;
            breaches.push({
              entityId: cert.hostname,
              severity: cert.daysRemaining < t.crit ? "crit" : "warn",
              value: cert.daysRemaining,
              message: `Certificate for ${cert.hostname} expires in ${cert.daysRemaining.toFixed(1)} days`,
            });
          }
          return breaches;
        },
      },
      overrides,
    ),
  ];
}
