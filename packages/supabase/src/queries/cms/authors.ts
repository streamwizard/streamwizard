import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../types/supabase";
import { withMetrics } from "../with-metrics";

/**
 * CMS authors. Service-role client only for writes; anon reads live authors
 * without user_id. Authors are soft-deleted (deleted_at) so posts that credit
 * them keep resolving.
 */

type DBClient = SupabaseClient<Database>;
export type CmsAuthor = Database["public"]["Tables"]["cms_authors"]["Row"];

const AUTHOR_COLUMNS =
  "id, user_id, slug, name, role_title, bio, avatar_asset_id, social_links, created_at, updated_at, deleted_at, avatar:cms_assets(id, key, alt), cms_content_authors(count)";

export interface CmsAuthorInput {
  slug: string;
  name: string;
  role_title: string | null;
  bio: string | null;
  avatar_asset_id: string | null;
  social_links: Json;
  user_id: string | null;
}

export const listCmsAuthors = withMetrics("cms_authors", "select", async (client: DBClient, includeDeleted = false) => {
  let query = client.from("cms_authors").select(AUTHOR_COLUMNS).order("name");
  if (!includeDeleted) query = query.is("deleted_at", null);
  return query;
});

export const getCmsAuthor = withMetrics("cms_authors", "select", async (client: DBClient, id: string) =>
  client.from("cms_authors").select(AUTHOR_COLUMNS).eq("id", id).maybeSingle(),
);

export const insertCmsAuthor = withMetrics(
  "cms_authors",
  "insert",
  async (client: DBClient, input: Pick<CmsAuthorInput, "slug" | "name">) =>
    client.from("cms_authors").insert(input).select("id").single(),
);

export const updateCmsAuthor = withMetrics(
  "cms_authors",
  "update",
  async (client: DBClient, id: string, input: CmsAuthorInput) =>
    client.from("cms_authors").update(input).eq("id", id).select("id").maybeSingle(),
);

/** Deleted authors keep their credits; their slug frees up for someone else. */
export const setCmsAuthorDeleted = withMetrics(
  "cms_authors",
  "update",
  async (client: DBClient, id: string, deleted: boolean) =>
    client
      .from("cms_authors")
      .update({ deleted_at: deleted ? new Date().toISOString() : null })
      .eq("id", id)
      .select("id")
      .maybeSingle(),
);
