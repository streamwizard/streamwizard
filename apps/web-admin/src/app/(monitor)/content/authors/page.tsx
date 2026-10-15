import { supabaseAdmin } from "@repo/supabase/next/admin";
import { listCmsAuthors } from "@repo/supabase/queries/cms/authors";
import { AuthorsView } from "@/components/content/authors-view";
import { cmsAssetUrl } from "@/lib/cms/storage";

export const dynamic = "force-dynamic";

export default async function AuthorsPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const showDeleted = (await searchParams).deleted === "1";
  const { data, error } = await listCmsAuthors(supabaseAdmin, showDeleted);
  if (error) throw error;
  return (
    <AuthorsView
      showDeleted={showDeleted}
      authors={(data ?? []).map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        roleTitle: row.role_title,
        avatarUrl: row.avatar ? cmsAssetUrl(row.avatar.key) : null,
        linked: row.user_id !== null,
        deleted: row.deleted_at !== null,
        postCount: row.cms_content_authors[0]?.count ?? 0,
      }))}
    />
  );
}
