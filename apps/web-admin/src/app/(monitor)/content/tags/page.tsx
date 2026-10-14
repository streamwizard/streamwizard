import { supabaseAdmin } from "@repo/supabase/next/admin";
import { listCmsTags } from "@repo/supabase/queries/cms/taxonomy";
import { TagsView } from "@/components/content/tags-view";

export const dynamic = "force-dynamic";

export default async function TagsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const search = (await searchParams).q?.trim() || undefined;
  const { data, error } = await listCmsTags(supabaseAdmin, search);
  if (error) throw error;
  return (
    <TagsView
      search={search}
      tags={(data ?? []).map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        postCount: row.cms_content_tags[0]?.count ?? 0,
      }))}
    />
  );
}
