import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/supabase";
import { withMetrics } from "../with-metrics";

/** CMS categories and tags. Writes are service-role only; anon reads both. */

type DBClient = SupabaseClient<Database>;
export type CmsCategory = Database["public"]["Tables"]["cms_categories"]["Row"];
export type CmsTag = Database["public"]["Tables"]["cms_tags"]["Row"];

export interface CmsCategoryInput {
  slug: string;
  name: string;
  description: string | null;
  position: number;
}

export interface CmsTagInput {
  slug: string;
  name: string;
}

/** Every category with how many posts (any status, trash included) use it. */
export const listCmsCategories = withMetrics("cms_categories", "select", async (client: DBClient) =>
  client
    .from("cms_categories")
    .select("id, slug, name, description, position, created_at, updated_at, cms_content_categories(count)")
    .order("position")
    .order("name"),
);

export const insertCmsCategory = withMetrics(
  "cms_categories",
  "insert",
  async (client: DBClient, input: CmsCategoryInput) =>
    client.from("cms_categories").insert(input).select("id").single(),
);

export const updateCmsCategory = withMetrics(
  "cms_categories",
  "update",
  async (client: DBClient, id: string, input: CmsCategoryInput) =>
    client.from("cms_categories").update(input).eq("id", id).select("id").maybeSingle(),
);

export const deleteCmsCategory = withMetrics("cms_categories", "delete", async (client: DBClient, id: string) =>
  client.from("cms_categories").delete().eq("id", id),
);

/** Tags with their usage count, alphabetical. */
export const listCmsTags = withMetrics("cms_tags", "select", async (client: DBClient, search?: string) => {
  let query = client
    .from("cms_tags")
    .select("id, slug, name, created_at, updated_at, cms_content_tags(count)")
    .order("name");
  const term = search?.replace(/[%_,()]/g, " ").trim();
  if (term) query = query.or(`name.ilike.%${term}%,slug.ilike.%${term}%`);
  return query;
});

export const insertCmsTag = withMetrics("cms_tags", "insert", async (client: DBClient, input: CmsTagInput) =>
  client.from("cms_tags").insert(input).select("id").single(),
);

export const updateCmsTag = withMetrics(
  "cms_tags",
  "update",
  async (client: DBClient, id: string, input: CmsTagInput) =>
    client.from("cms_tags").update(input).eq("id", id).select("id").maybeSingle(),
);

export const deleteCmsTag = withMetrics("cms_tags", "delete", async (client: DBClient, id: string) =>
  client.from("cms_tags").delete().eq("id", id),
);

/** The posts a tag is on. For merging, and for knowing which pages to refresh. */
export const selectCmsTagContentIds = withMetrics(
  "cms_content_tags",
  "select",
  async (client: DBClient, tagId: string) => client.from("cms_content_tags").select("content_id").eq("tag_id", tagId),
);

/** Puts `targetId` on every post in `contentIds`; posts that already have it are left alone. */
export const addCmsTagToContent = withMetrics(
  "cms_content_tags",
  "upsert",
  async (client: DBClient, targetId: string, contentIds: string[]) =>
    client.from("cms_content_tags").upsert(
      contentIds.map((contentId) => ({ content_id: contentId, tag_id: targetId })),
      { onConflict: "content_id,tag_id", ignoreDuplicates: true },
    ),
);
