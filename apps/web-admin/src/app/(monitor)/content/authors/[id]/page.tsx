import { notFound } from "next/navigation";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { listUsers } from "@repo/supabase/queries/admin-users";
import { getCmsAuthor } from "@repo/supabase/queries/cms/authors";
import { AuthorEditor } from "@/components/content/author-editor";
import type { SocialLinks } from "@/lib/cms/authors";
import { cmsAssetUrl } from "@/lib/cms/storage";
import { userAvatarUrl, userDisplayName } from "@/lib/users";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AuthorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { data: author, error } = await getCmsAuthor(supabaseAdmin, id);
  if (error) throw error;
  if (!author) notFound();

  // The linked account, shown by name: search by id finds exactly that user.
  const account = author.user_id
    ? (await listUsers(supabaseAdmin, { search: author.user_id }, 1, 1)).users[0]
    : undefined;

  return (
    <AuthorEditor
      key={author.updated_at}
      initial={{
        id: author.id,
        name: author.name,
        slug: author.slug,
        roleTitle: author.role_title ?? "",
        bio: author.bio ?? "",
        socialLinks: (author.social_links ?? {}) as SocialLinks,
        avatar: author.avatar
          ? { id: author.avatar.id, url: cmsAssetUrl(author.avatar.key), alt: author.avatar.alt }
          : null,
        account: account
          ? { id: account.id, name: userDisplayName(account), email: account.email, avatarUrl: userAvatarUrl(account) }
          : author.user_id
            ? { id: author.user_id, name: "Unknown account", email: "", avatarUrl: null }
            : null,
        deleted: author.deleted_at !== null,
        postCount: author.cms_content_authors[0]?.count ?? 0,
      }}
    />
  );
}
