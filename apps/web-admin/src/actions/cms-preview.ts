"use server";

import { z } from "zod";
import { createPreviewToken, hashPreviewToken, isPreviewDuration, toPgBytea } from "@repo/cms/preview-token";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import {
  insertCmsPreviewToken,
  listActiveCmsPreviewTokens,
  revokeCmsPreviewToken,
} from "@repo/supabase/queries/cms/preview";
import { CmsError, requireCmsAdmin, toCmsActionError, type CmsActionResult } from "@/lib/cms/action";
import { env } from "@/lib/env";

// Preview links: show a draft on the real site, to an admin or to anyone
// they send the link to. The token is shown once; only its hash is stored.

const idSchema = z.string().uuid();

export interface PreviewLink {
  id: string;
  expiresAt: string;
  createdAt: string;
}

export interface CreatePreviewResult extends CmsActionResult {
  url: string | null;
  link: PreviewLink | null;
}

export async function createPreviewLinkAction(contentId: string, hours: number): Promise<CreatePreviewResult> {
  try {
    const actor = await requireCmsAdmin();
    if (!idSchema.safeParse(contentId).success) throw new CmsError("That post doesn't exist anymore.");
    if (!isPreviewDuration(hours)) throw new CmsError("Pick 1 hour, 24 hours or 7 days.");
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
): Promise<{ error: string | null; links: PreviewLink[] }> {
  try {
    await requireCmsAdmin();
    if (!idSchema.safeParse(contentId).success) return { error: null, links: [] };
    const { data, error } = await listActiveCmsPreviewTokens(supabaseAdmin, contentId);
    if (error) throw error;
    return {
      error: null,
      links: (data ?? []).map((row) => ({ id: row.id, expiresAt: row.expires_at, createdAt: row.created_at })),
    };
  } catch (error) {
    return { ...toCmsActionError(error, "list previews", "Couldn't load the preview links."), links: [] };
  }
}

export async function revokePreviewLinkAction(contentId: string, id: string): Promise<CmsActionResult> {
  try {
    await requireCmsAdmin();
    if (!idSchema.safeParse(contentId).success || !idSchema.safeParse(id).success) return { error: null };
    const { error } = await revokeCmsPreviewToken(supabaseAdmin, id, contentId);
    if (error) throw error;
    return { error: null };
  } catch (error) {
    return toCmsActionError(error, "revoke preview", "Couldn't turn that link off. Try again?");
  }
}
