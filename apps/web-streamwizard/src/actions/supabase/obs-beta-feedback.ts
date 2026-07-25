"use server";

import { createClient } from "@repo/supabase/next/server";
import type { Database } from "@repo/supabase";
import { reportError } from "@repo/sentry";
import { betaFeedbackSchema, type BetaFeedbackValues } from "@/schemas/obs-beta-feedback";

export type ObsBetaFeedbackRow = Database["public"]["Tables"]["obs_beta_feedback"]["Row"];

export async function getObsBetaFeedback(): Promise<ObsBetaFeedbackRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("obs_beta_feedback")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    reportError(error, "obs-beta-feedback: fetch");
    return null;
  }
  return data;
}

export async function saveObsBetaFeedback(values: BetaFeedbackValues): Promise<{ ok: boolean; error?: string }> {
  const parsed = betaFeedbackSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid answers" };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, error: "Not signed in" };

  const { error } = await supabase.from("obs_beta_feedback").upsert({
    user_id: user.id,
    tester_info: parsed.data.tester_info,
    responses: parsed.data.responses,
    overall: parsed.data.overall,
  });

  if (error) {
    reportError(error, "obs-beta-feedback: save");
    return { ok: false, error: "Couldn't save your answers. Try again?" };
  }
  return { ok: true };
}

export async function submitObsBetaFeedback(values: BetaFeedbackValues): Promise<{ ok: boolean; error?: string }> {
  const parsed = betaFeedbackSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid answers" };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, error: "Not signed in" };

  const { error } = await supabase.from("obs_beta_feedback").upsert({
    user_id: user.id,
    tester_info: parsed.data.tester_info,
    responses: parsed.data.responses,
    overall: parsed.data.overall,
    status: "submitted",
    submitted_at: new Date().toISOString(),
  });

  if (error) {
    reportError(error, "obs-beta-feedback: submit");
    return { ok: false, error: "Couldn't submit. Try again?" };
  }
  return { ok: true };
}
