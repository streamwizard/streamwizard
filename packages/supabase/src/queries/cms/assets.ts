import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/supabase";
import { withMetrics } from "../with-metrics";

/**
 * CMS images (covers, inline images, OG images, avatars), uploaded by admins
 * in web-admin. Service-role client only: anon sees nothing here except the
 * avatars of live authors (see 20261014120000_cms_taxonomy_authors_assets.sql).
 */

type DBClient = SupabaseClient<Database>;
export type CmsAsset = Database["public"]["Tables"]["cms_assets"]["Row"];

const ASSET_COLUMNS = "id, key, mime_type, size_bytes, width, height, alt, is_decorative, status, created_at";

export interface InsertPendingCmsAssetInput {
  id: string;
  key: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  alt: string;
  isDecorative: boolean;
  createdBy: string;
}

export const insertPendingCmsAsset = withMetrics(
  "cms_assets",
  "insert",
  async (client: DBClient, input: InsertPendingCmsAssetInput) =>
    client.from("cms_assets").insert({
      id: input.id,
      key: input.key,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      width: input.width,
      height: input.height,
      alt: input.alt,
      is_decorative: input.isDecorative,
      status: "pending",
      created_by: input.createdBy,
    }),
);

export const selectCmsAsset = withMetrics("cms_assets", "select", async (client: DBClient, id: string) =>
  client.from("cms_assets").select(ASSET_COLUMNS).eq("id", id).maybeSingle(),
);

/** The size R2 reports is the one we keep: it is what was actually stored. */
export const markCmsAssetReady = withMetrics(
  "cms_assets",
  "update",
  async (client: DBClient, id: string, sizeBytes: number) =>
    client
      .from("cms_assets")
      .update({ status: "ready", size_bytes: sizeBytes })
      .eq("id", id)
      .eq("status", "pending")
      .select(ASSET_COLUMNS)
      .maybeSingle(),
);

export const updateCmsAssetAlt = withMetrics(
  "cms_assets",
  "update",
  async (client: DBClient, id: string, alt: string, isDecorative: boolean) =>
    client
      .from("cms_assets")
      .update({ alt, is_decorative: isDecorative })
      .eq("id", id)
      .select(ASSET_COLUMNS)
      .maybeSingle(),
);

export const deleteCmsAssetRow = withMetrics("cms_assets", "delete", async (client: DBClient, id: string) =>
  client.from("cms_assets").delete().eq("id", id),
);

export interface CmsAssetListFilters {
  /** Matches the file name (it is part of the key) or the alt text. */
  search?: string;
}

/** Ready images, newest first. */
export const listCmsAssets = withMetrics(
  "cms_assets",
  "select",
  async (client: DBClient, filters: CmsAssetListFilters, page: number, pageSize: number) => {
    let query = client
      .from("cms_assets")
      .select(ASSET_COLUMNS, { count: "exact" })
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    const search = filters.search?.replace(/[%_,()]/g, " ").trim();
    if (search) query = query.or(`key.ilike.%${search}%,alt.ilike.%${search}%`);
    return query;
  },
);

/**
 * Ready images nothing references (no post, section, revision, published copy
 * or avatar). Same rule the cleanup job uses, so "Unused" in the media
 * library means exactly "safe to delete".
 */
export const selectUnreferencedCmsAssets = withMetrics(
  "cms_assets",
  "select",
  async (client: DBClient, olderThan: string = "0 seconds") =>
    client.rpc("cms_unreferenced_assets", { p_older_than: olderThan }),
);
