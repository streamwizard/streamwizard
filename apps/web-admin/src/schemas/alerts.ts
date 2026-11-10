import { z } from "zod";
import type { Env } from "@repo/alerting/types";

/** The environments an alert rule or notification route covers. */
export const alertEnvSchema = z.enum(["prod", "staging", "dev"] satisfies Env[]);

/** off / warn / crit, the lowest severity a channel still gets. */
export const severityGateSchema = z.enum(["off", "warn", "crit"]);
