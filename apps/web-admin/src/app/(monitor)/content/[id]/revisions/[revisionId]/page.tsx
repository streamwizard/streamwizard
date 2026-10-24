import { notFound } from "next/navigation";
import { sanitizeDoc } from "@repo/cms";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getCmsContentForEditor, getCmsRevision } from "@repo/supabase/queries/cms/content";
import { RevisionCompare } from "@/components/content/revision-compare";
import { contentType, draftFromRow } from "@/lib/cms/draft-row";
import { compareRevision, type ComparableFields } from "@/lib/cms/revision-diff";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const str = (value: unknown) => (typeof value === "string" ? value : "");

/** A revision snapshot is a row-shaped copy of the working copy at that moment. */
function fromSnapshot(snapshot: Record<string, unknown>): ComparableFields {
  const sections = Array.isArray(snapshot.sections) ? (snapshot.sections as Record<string, unknown>[]) : [];
  return {
    title: str(snapshot.title),
    slug: str(snapshot.slug),
    summary: str(snapshot.summary),
    excerpt: str(snapshot.excerpt),
    seoTitle: str(snapshot.seo_title),
    seoDescription: str(snapshot.seo_description),
    body: sanitizeDoc(snapshot.body).doc,
    sections: sections.map((section) => ({ title: str(section.title), body: sanitizeDoc(section.body).doc })),
  };
}

export default async function RevisionComparePage({ params }: { params: Promise<{ id: string; revisionId: string }> }) {
  const { id, revisionId } = await params;
  if (!UUID.test(id) || !UUID.test(revisionId)) notFound();
  const [{ data: row, error }, revision] = await Promise.all([
    getCmsContentForEditor(supabaseAdmin, id),
    getCmsRevision(supabaseAdmin, id, revisionId),
  ]);
  if (error) throw error;
  if (revision.error) throw revision.error;
  if (!row || row.deleted_at || !revision.data) notFound();

  const draft = draftFromRow(row);
  const guide = contentType(row) === "guide";
  const snapshot = (revision.data.snapshot ?? {}) as Record<string, unknown>;

  return (
    <RevisionCompare
      contentId={row.id}
      title={row.title.trim() || "Untitled"}
      lockVersion={row.lock_version}
      revision={{
        id: revision.data.id,
        kind: revision.data.kind as "autosave" | "manual" | "publish" | "restore",
        createdAt: revision.data.created_at,
        title: str(snapshot.title),
        words: Number(snapshot.word_count ?? 0),
      }}
      changes={compareRevision(fromSnapshot(snapshot), draft, guide)}
    />
  );
}
