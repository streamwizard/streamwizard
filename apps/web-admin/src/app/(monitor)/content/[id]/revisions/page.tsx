import { notFound } from "next/navigation";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getCmsContentForEditor, listCmsRevisions } from "@repo/supabase/queries/cms/content";
import { RevisionList } from "@/components/content/revision-list";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function RevisionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [{ data: row, error }, revisions] = await Promise.all([
    getCmsContentForEditor(supabaseAdmin, id),
    listCmsRevisions(supabaseAdmin, id),
  ]);
  if (error) throw error;
  if (revisions.error) throw revisions.error;
  if (!row || row.deleted_at) notFound();

  return (
    <RevisionList
      contentId={row.id}
      title={row.title.trim() || "Untitled"}
      lockVersion={row.lock_version}
      revisions={(revisions.data ?? []).map((revision) => ({
        id: revision.id,
        kind: revision.kind as "autosave" | "manual" | "publish" | "restore",
        createdAt: revision.created_at,
        title: (revision.title as string | null) ?? "",
        words: Number(revision.word_count ?? 0),
      }))}
    />
  );
}
