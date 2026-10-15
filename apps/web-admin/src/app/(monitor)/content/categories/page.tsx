import { supabaseAdmin } from "@repo/supabase/next/admin";
import { listCmsCategories } from "@repo/supabase/queries/cms/taxonomy";
import { CategoriesView } from "@/components/content/categories-view";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const { data, error } = await listCmsCategories(supabaseAdmin);
  if (error) throw error;
  return (
    <CategoriesView
      categories={(data ?? []).map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        position: row.position,
        postCount: row.cms_content_categories[0]?.count ?? 0,
      }))}
    />
  );
}
