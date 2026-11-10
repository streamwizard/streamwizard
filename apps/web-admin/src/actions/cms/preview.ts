"use server";

import { z } from "zod";
import { createPreviewToken, hashPreviewToken, isPreviewDuration, toPgBytea } from "@repo/cms/preview-token";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import {
  insertCmsPreviewToken,
  listActiveCmsPreviewTokens,
  revokeCmsPreviewToken,
} from "@repo/supabase/queries/cms/preview";
import { CmsError, parseCmsInput, requireCmsAdmin, toCmsActionError, type CmsActionResult } from "@/lib/cms/action";
import { env } from "@/lib/env";
import { cmsIdSchema } from "@/schemas/cms";
import type { CmsPreviewLink } from "@/types/cms";

// Preview links: show a draft on the real site, to an admin or to anyone
// they send the link to. The token is shown once; only its hash is stored.

const idSchema = cmsIdSchema("That post doesn't exist anymore.");

const createSchema = z.object({
  contentId: idSchema,
  hours: z.custom<number>((value) => typeof value === "number" && isPreviewDuration(value), "Pick 1 hour, 24 hours or 7 days."),
});
const revokeSchema = z.object({ contentId: idSchema, id: idSchema });

interface CreatePreviewResult extends CmsActionResult {
  url: string | null;
  link: CmsPreviewLink | null;
}

export async function createPreviewLinkAction(rawContentId: string, rawHours: number): Promise<CreatePreviewResult> {
  try {
    const actor = await requireCmsAdmin();
    const { contentId, hours } = parseCmsInput(createSchema, { contentId: rawContentId, hours: rawHours });
    if (!env.CMS_SITE_URL) throw new CmsError("Preview links need CMS_SITE_URL in this environment.");

    const token = createPreviewToken();
    const { data, error } = await insertCmsPreviewToken(supabaseAdmin, {
      contentId,
      tokenHash: toPgBytea(hashPreviewToken(token)),
      expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000).toISOString(),
      createdBy: actor,
    });
    if (error) throw error;
    return {
      error: null,
      url: new URL(`/preview/${token}`, env.CMS_SITE_URL).toString(),
      link: { id: data.id, expiresAt: data.expires_at, createdAt: data.created_at },
    };
  } catch (error) {
    return {
      ...toCmsActionError(error, "create preview", "Couldn't make a preview link. Try again?"),
      url: null,
      link: null,
    };
  }
}

export async function listPreviewLinksAction(
  contentId: string,
): Promise<{ error: string | null; links: CmsPreviewLink[] }> {
  try {
    await requireCmsAdmin();
    // A post that doesn't exist has no links: an empty list, not an error.
    const parsed = idSchema.safeParse(contentId);
    if (!parsed.success) return { error: null, links: [] };
    const { data, error } = await listActiveCmsPreviewTokens(supabaseAdmin, parsed.data);
    if (error) throw error;
    return {
      error: null,
      links: (data ?? []).map((row) => ({ id: row.id, expiresAt: row.expires_at, createdAt: row.created_at })),
    };
  } catch (error) {
    return { ...toCmsActionError(error, "list previews", "Couldn't load the preview links."), links: [] };
  }
}

export async function revokePreviewLinkAction(rawContentId: string, rawId: string): Promise<CmsActionResult> {
  try {
    await requireCmsAdmin();
    // A link that can't exist is already off.
    const parsed = revokeSchema.safeParse({ contentId: rawContentId, id: rawId });
    if (!parsed.success) return { error: null };
    const { contentId, id } = parsed.data;
    const { error } = await revokeCmsPreviewToken(supabaseAdmin, id, contentId);
    if (error) throw error;
    return { error: null };
  } catch (error) {
    return toCmsActionError(error, "revoke preview", "Couldn't turn that link off. Try again?");
  }
}
