"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Link2Off, RotateCcw, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { isValidSlug } from "@repo/cms";
import { Avatar, AvatarFallback, AvatarImage, Badge, Button, Card, CardContent, Input, Textarea } from "@repo/ui";
import {
  saveAuthorAction,
  searchAuthorAccountsAction,
  setAuthorDeletedAction,
  type AccountOption,
} from "@/actions/cms-authors";
import { PageHeader } from "@/components/widgets/page-header";
import { SaveBar } from "@/components/widgets/save-bar";
import { MAX_BIO_LENGTH, SOCIAL_LINKS, parseSocialLinks, type SocialLinks } from "@/lib/cms/authors";
import { PageCrumb } from "@/lib/crumbs";
import { ConfirmButton } from "./confirm-button";
import { FormField } from "./form-field";
import { ImagePickerDialog } from "./image-picker-dialog";

interface AuthorAvatar {
  id: string;
  url: string;
  alt: string;
}

export interface AuthorEditorState {
  id: string;
  name: string;
  slug: string;
  roleTitle: string;
  bio: string;
  socialLinks: SocialLinks;
  avatar: AuthorAvatar | null;
  account: AccountOption | null;
  deleted: boolean;
  postCount: number;
}

type Draft = Omit<AuthorEditorState, "id" | "deleted" | "postCount">;

function sameDraft(a: Draft, b: Draft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function AccountLink({
  account,
  onChange,
}: {
  account: AccountOption | null;
  onChange: (account: AccountOption | null) => void;
}) {
  const uid = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AccountOption[] | null>(null);
  const [pending, start] = useTransition();

  const search = () =>
    start(async () => {
      const result = await searchAuthorAccountsAction(query);
      if (result.error) return void toast.error(result.error);
      setResults(result.accounts);
    });

  if (account) {
    return (
      <div className="flex items-center gap-3 rounded-md border p-3">
        <Avatar className="size-8">
          {account.avatarUrl && <AvatarImage src={account.avatarUrl} alt="" />}
          <AvatarFallback className="text-xs">{account.name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 text-sm">
          <p className="truncate font-medium">{account.name}</p>
          {account.email && <p className="truncate text-xs text-muted-foreground">{account.email}</p>}
        </div>
        <Button variant="ghost" size="sm" className="h-11 md:h-8" onClick={() => onChange(null)}>
          <Link2Off aria-hidden />
          Unlink
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          search();
        }}
      >
        <Input
          id={`${uid}-search`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Name, email or Twitch login"
          aria-label="Search accounts"
        />
        <Button type="submit" variant="secondary" disabled={pending || query.trim().length < 2}>
          <Search aria-hidden />
          Find
        </Button>
      </form>
      {results && (
        <ul className="divide-y rounded-md border text-sm">
          {results.length === 0 && <li className="p-3 text-muted-foreground">No accounts match.</li>}
          {results.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                onClick={() => {
                  onChange(option);
                  setResults(null);
                  setQuery("");
                }}
              >
                <Avatar className="size-7">
                  {option.avatarUrl && <AvatarImage src={option.avatarUrl} alt="" />}
                  <AvatarFallback className="text-xs">{option.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{option.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{option.email}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** One author's public profile. Saved with the bar at the bottom, not autosaved. */
export function AuthorEditor({ initial }: { initial: AuthorEditorState }) {
  const uid = useId();
  const router = useRouter();
  const saved: Draft = useMemo(
    () => ({
      name: initial.name,
      slug: initial.slug,
      roleTitle: initial.roleTitle,
      bio: initial.bio,
      socialLinks: initial.socialLinks,
      avatar: initial.avatar,
      account: initial.account,
    }),
    [initial],
  );
  const [draft, setDraft] = useState<Draft>(saved);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, start] = useTransition();
  const dirty = !sameDraft(draft, saved);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const slugProblem =
    draft.slug && !isValidSlug(draft.slug) ? "Lowercase letters, numbers and single dashes only." : null;
  const linkProblem = parseSocialLinks(draft.socialLinks).error;

  const save = () =>
    start(async () => {
      const result = await saveAuthorAction(initial.id, {
        name: draft.name,
        slug: draft.slug,
        roleTitle: draft.roleTitle,
        bio: draft.bio,
        avatarAssetId: draft.avatar?.id ?? null,
        userId: draft.account?.id ?? null,
        socialLinks: draft.socialLinks as Record<string, string>,
      });
      if (result.error) return void toast.error(result.error);
      toast.success("Author saved.");
      router.refresh();
    });

  const setDeleted = (deleted: boolean) =>
    start(async () => {
      const result = await setAuthorDeletedAction(initial.id, deleted);
      if (result.error) return void toast.error(result.error);
      toast.success(deleted ? "Author deleted. Their posts keep the credit." : "Author restored.");
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-6">
      <PageCrumb label={initial.name} href={`/content/authors/${initial.id}`} />
      <PageHeader
        title={initial.name}
        description={`${initial.postCount} post${initial.postCount === 1 ? "" : "s"} credited. Public page: streamwizard.org/authors/${initial.slug}`}
      >
        {initial.deleted ? (
          <>
            <Badge variant="outline">Deleted</Badge>
            <Button variant="outline" className="h-11 md:h-9" onClick={() => setDeleted(false)} disabled={pending}>
              <RotateCcw aria-hidden />
              Restore
            </Button>
          </>
        ) : (
          <ConfirmButton
            title={`Delete ${initial.name}?`}
            description="Their author page goes offline. Posts keep the credit, and you can restore the author later."
            onConfirm={() => setDeleted(true)}
          >
            <Button variant="outline" className="h-11 md:h-9" disabled={pending}>
              <Trash2 aria-hidden />
              Delete
            </Button>
          </ConfirmButton>
        )}
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardContent className="space-y-4">
            <FormField label="Name" htmlFor={`${uid}-name`}>
              <Input
                id={`${uid}-name`}
                value={draft.name}
                maxLength={80}
                onChange={(event) => set("name", event.target.value)}
              />
            </FormField>
            <FormField
              label="Slug"
              htmlFor={`${uid}-slug`}
              hint={slugProblem ?? `streamwizard.org/authors/${draft.slug || "…"}`}
            >
              <Input
                id={`${uid}-slug`}
                value={draft.slug}
                maxLength={80}
                aria-invalid={slugProblem ? true : undefined}
                onChange={(event) => set("slug", event.target.value)}
              />
            </FormField>
            <FormField
              label="Role"
              htmlFor={`${uid}-role`}
              hint="Shown under the name, like Founder or Streamer. Optional."
            >
              <Input
                id={`${uid}-role`}
                value={draft.roleTitle}
                maxLength={80}
                onChange={(event) => set("roleTitle", event.target.value)}
              />
            </FormField>
            <FormField
              label="Bio"
              htmlFor={`${uid}-bio`}
              hint={`${draft.bio.length}/${MAX_BIO_LENGTH}. Plain text. Say what they stream and what they know.`}
            >
              <Textarea
                id={`${uid}-bio`}
                value={draft.bio}
                maxLength={MAX_BIO_LENGTH}
                rows={5}
                onChange={(event) => set("bio", event.target.value)}
              />
            </FormField>
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Links</legend>
              <p className="text-xs text-muted-foreground">
                Used for the author page and to show search engines who they are. Full https:// URLs.
              </p>
              {SOCIAL_LINKS.map(({ key, label, placeholder }) => (
                <FormField key={key} label={label} htmlFor={`${uid}-${key}`}>
                  <Input
                    id={`${uid}-${key}`}
                    type="url"
                    inputMode="url"
                    value={draft.socialLinks[key] ?? ""}
                    placeholder={placeholder}
                    onChange={(event) => set("socialLinks", { ...draft.socialLinks, [key]: event.target.value })}
                  />
                </FormField>
              ))}
              {linkProblem && <p className="text-xs text-destructive">{linkProblem}</p>}
            </fieldset>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="space-y-3">
              <p className="text-sm font-medium">Avatar</p>
              <div className="flex items-center gap-4">
                <Avatar className="size-20">
                  {draft.avatar && <AvatarImage src={draft.avatar.url} alt={draft.avatar.alt} />}
                  <AvatarFallback>{draft.name.slice(0, 2).toUpperCase() || "?"}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-2">
                  <Button variant="outline" size="sm" className="h-11 md:h-8" onClick={() => setPickerOpen(true)}>
                    <ImagePlus aria-hidden />
                    {draft.avatar ? "Change" : "Choose"}
                  </Button>
                  {draft.avatar && (
                    <Button variant="ghost" size="sm" className="h-11 md:h-8" onClick={() => set("avatar", null)}>
                      <X aria-hidden />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium">StreamWizard account</p>
                <p className="text-xs text-muted-foreground">
                  Optional and private: lets their comments show an author badge later.
                </p>
              </div>
              <AccountLink account={draft.account} onChange={(account) => set("account", account)} />
            </CardContent>
          </Card>
        </div>
      </div>

      <SaveBar
        sticky
        dirty={dirty}
        pending={pending}
        onReset={() => setDraft(saved)}
        onSave={() => {
          if (slugProblem || linkProblem) return void toast.error(slugProblem ?? linkProblem);
          save();
        }}
      />

      <ImagePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        purpose="avatar"
        defaultAlt={draft.name}
        onPick={(asset) => set("avatar", { id: asset.id, url: asset.url, alt: asset.alt })}
      />
    </div>
  );
}
