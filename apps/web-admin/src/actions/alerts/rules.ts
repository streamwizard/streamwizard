"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { upsertAlertRuleConfig, deleteAlertRuleConfig } from "@repo/supabase/queries/alerts/rule-config";
import { getRuleCatalog } from "@repo/alerting/rules";
import { ActionError, toActionError, type ActionResult } from "@/lib/actions/action-error";
import { requireAdmin } from "@/lib/auth/admin-context";
import { alertEnvSchema } from "@/schemas/alerts";

const ruleIdSchema = z.string().min(1).max(100);
const ruleConfigSchema = z.object({
  ruleId: ruleIdSchema,
  enabled: z.boolean(),
  /** null = use the code default. */
  warn: z.number().finite().nullable(),
  crit: z.number().finite().nullable(),
  forTicks: z.number().int().min(1).max(10).nullable(),
  envs: z.array(alertEnvSchema).min(1).max(3).nullable(),
});

const RULES_PATH = "/alerts/rules";

function badRuleInput(error: z.ZodError): string {
  switch (error.issues[0]?.path[0]) {
    case "forTicks":
      return "For-ticks must be a whole number between 1 and 10";
    case "envs":
      return "Envs must be a non-empty subset of prod/staging/dev";
    case "warn":
    case "crit":
      return "Thresholds must be numbers";
    default:
      return "That rule can't be saved. Reload the page and try again.";
  }
}

/** Persist a rule override; the engine picks it up on its next tick (≤60s). */
export async function saveRuleConfig(input: z.input<typeof ruleConfigSchema>): Promise<ActionResult> {
  try {
    const userId = await requireAdmin();
    const parsed = ruleConfigSchema.safeParse(input);
    if (!parsed.success) return { error: badRuleInput(parsed.error) };
    const rule = parsed.data;

    const entry = getRuleCatalog().find((r) => r.id === rule.ruleId);
    if (!entry) throw new ActionError(`Unknown rule: ${rule.ruleId}`);
    if (rule.warn !== null && entry.warn === undefined) throw new ActionError(`Rule ${rule.ruleId} has no editable warn threshold`);
    if (rule.crit !== null && entry.crit === undefined) throw new ActionError(`Rule ${rule.ruleId} has no editable crit threshold`);

    // An all-default override is the same as no override — keep the table clean.
    // A rule that is off in code needs its row to stay on.
    const isAllDefault =
      rule.enabled === entry.defaultEnabled && rule.warn === null && rule.crit === null && rule.forTicks === null && rule.envs === null;

    if (isAllDefault) {
      await deleteAlertRuleConfig(supabaseAdmin, rule.ruleId);
    } else {
      await upsertAlertRuleConfig(supabaseAdmin, {
        rule_id: rule.ruleId,
        enabled: rule.enabled,
        warn: rule.warn,
        crit: rule.crit,
        for_ticks: rule.forTicks,
        envs: rule.envs,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      });
    }

    revalidatePath(RULES_PATH);
    return { error: null };
  } catch (error) {
    return toActionError(error, "alerts.save-rule", "Couldn't save. Try again?");
  }
}

/** Back to code defaults = drop the override row. */
export async function resetRuleConfig(ruleId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const id = ruleIdSchema.safeParse(ruleId);
    if (!id.success) return { error: "That rule doesn't exist." };

    await deleteAlertRuleConfig(supabaseAdmin, id.data);
    revalidatePath(RULES_PATH);
    return { error: null };
  } catch (error) {
    return toActionError(error, "alerts.reset-rule", "Couldn't reset. Try again?");
  }
}
