import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowUp, ChevronDown } from "lucide-react";
import { contentIndexPath, pageOutline, type Doc } from "@repo/cms";
import { DIFFICULTY_LABELS, LONG_DATE } from "@/lib/cms/published";
import { cn } from "@/lib/utils";
import { ArticleToc } from "./article-toc";
import { CMS_PROSE, CmsDocument, type ResolvedImage } from "./cms-document";

// One blog post or guide, laid out for reading. The draft preview and the
// published pages both use it, so a preview looks like the real thing.
//
// Wide screens get a reading column plus a sticky rail (guide facts, the
// table of contents following the reader, back to top). Below lg the rail's
// contents fold into the column: facts under the header, the table of
// contents as a disclosure above the body.

export interface ArticleAuthor {
  name: string;
  roleTitle: string | null;
  avatarUrl: string | null;
}

export interface ArticleData {
  type: "blog" | "guide";
  title: string;
  summary: string | null;
  cover: (ResolvedImage & { alt: string }) | null;
  authors: ArticleAuthor[];
  categories: string[];
  tags: string[];
  readingMinutes: number;
  publishedAt: string | null;
  updatedAt: string | null;
  difficulty: "beginner" | "intermediate" | "advanced" | null;
  estimatedMinutes: number | null;
  prerequisites: string[];
  body: Doc;
  /** `anchor` is the one the section was published with; absent on content written before anchors. */
  sections: { title: string; body: Doc; anchor?: string | null }[];
}

function formatDate(iso: string): string {
  return LONG_DATE.format(new Date(iso));
}

function AuthorAvatar({ author }: { author: ArticleAuthor }) {
  if (author.avatarUrl) {
    return (
      <Image
        src={author.avatarUrl}
        alt=""
        width={40}
        height={40}
        className="size-10 rounded-full border-2 border-background object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="inline-flex size-10 items-center justify-center rounded-full border-2 border-background bg-muted text-sm font-medium uppercase text-muted-foreground"
    >
      {author.name.trim().charAt(0) || "?"}
    </span>
  );
}

/** Level, time and prerequisites of a guide. `rail` stacks them for the sidebar. */
function GuideFacts({ data, rail = false }: { data: ArticleData; rail?: boolean }) {
  const facts = [
    data.difficulty && { label: "Level", value: DIFFICULTY_LABELS[data.difficulty] },
    data.estimatedMinutes && { label: "Takes about", value: `${data.estimatedMinutes} min` },
    { label: "Reading time", value: `${data.readingMinutes} min` },
  ].filter((fact): fact is { label: string; value: string } => Boolean(fact));

  return (
    <div className="text-sm">
      <dl className={cn(rail ? "grid grid-cols-2 gap-x-6 gap-y-4" : "flex flex-wrap gap-x-10 gap-y-4")}>
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="text-muted-foreground">{fact.label}</dt>
            <dd className="mt-1 font-medium text-foreground">{fact.value}</dd>
          </div>
        ))}
      </dl>
      {data.prerequisites.length > 0 && (
        <div className="mt-6 border-t border-border pt-5">
          <p className="text-muted-foreground">Before you start</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-6 text-foreground marker:text-muted-foreground">
            {data.prerequisites.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export interface RelatedLink {
  title: string;
  path: string;
  type: "blog" | "guide";
}

interface CmsArticleProps {
  data: ArticleData;
  resolveImage: (attrs: Record<string, unknown>) => ResolvedImage | null;
  parentHost: string;
  /** Shown in the sidebar. The page lists them again as cards under the article. */
  related?: RelatedLink[];
}

export function CmsArticle({ data, resolveImage, parentHost, related = [] }: CmsArticleProps) {
  const guide = data.type === "guide";
  const outline = pageOutline(data.body, data.sections);
  const toc = outline.toc.filter((entry) => entry.level <= 3);
  const showToc = guide ? toc.length > 1 : toc.length >= 3;
  const hasFacts = guide && Boolean(data.difficulty || data.estimatedMinutes || data.prerequisites.length > 0);
  const hasRail = showToc || hasFacts || related.length > 0;
  const byline = data.authors.map((author) => author.name).join(", ");
  const updated = data.updatedAt && data.publishedAt && data.updatedAt.slice(0, 10) !== data.publishedAt.slice(0, 10);

  return (
    <article className="mx-auto max-w-6xl px-4 py-12 selection:bg-[var(--color-three)]/30 sm:px-6 sm:py-16 lg:py-20">
      <div
        className={cn(
          hasRail &&
            "lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-16 xl:grid-cols-[minmax(0,1fr)_16rem] xl:gap-24",
        )}
      >
        <div className={cn("min-w-0 max-w-3xl", !hasRail && "mx-auto")}>
          <header>
            <Link
              href={contentIndexPath(data.type)}
              className="inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              <ArrowLeft className="size-4" aria-hidden />
              {guide ? "All guides" : "All posts"}
            </Link>
            <h1 className="mt-8 text-balance text-4xl font-semibold tracking-tight sm:text-5xl sm:leading-[1.08]">
              {data.title || "Untitled"}
            </h1>
            {data.summary && (
              <p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-foreground/75 sm:text-xl sm:leading-9">
                {data.summary}
              </p>
            )}
            <div className="mt-8 flex items-center gap-3 text-sm">
              {data.authors.length > 0 && (
                <span className="flex shrink-0 -space-x-2">
                  {data.authors.map((author) => (
                    <AuthorAvatar key={author.name} author={author} />
                  ))}
                </span>
              )}
              <div className="min-w-0">
                {byline && <p className="font-medium text-foreground">{byline}</p>}
                <p className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                  {data.categories.length > 0 && <span>{data.categories.join(", ")}</span>}
                  {data.publishedAt && <time dateTime={data.publishedAt}>{formatDate(data.publishedAt)}</time>}
                  {updated && data.updatedAt && (
                    <span>
                      Updated <time dateTime={data.updatedAt}>{formatDate(data.updatedAt)}</time>
                    </span>
                  )}
                  {!guide && <span>{data.readingMinutes} min read</span>}
                </p>
              </div>
            </div>
          </header>

          {hasFacts && (
            <div className={cn("mt-10 border-y border-border py-6", hasRail && "lg:hidden")}>
              <GuideFacts data={data} />
            </div>
          )}

          {data.cover && (
            <figure className="mt-10">
              {data.cover.width && data.cover.height ? (
                <Image
                  src={data.cover.src}
                  alt={data.cover.alt}
                  width={data.cover.width}
                  height={data.cover.height}
                  priority
                  sizes="(min-width: 1024px) 768px, 100vw"
                  className="h-auto w-full rounded-2xl border border-border"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- no stored size to give next/image
                <img
                  src={data.cover.src}
                  alt={data.cover.alt}
                  className="h-auto w-full rounded-2xl border border-border"
                />
              )}
            </figure>
          )}

          {showToc && (
            <details className="group mt-10 rounded-xl border border-border lg:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-5 py-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                On this page
                <ChevronDown
                  className="size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
                  aria-hidden
                />
              </summary>
              <nav aria-label="On this page" className="px-5 pb-5">
                <ArticleToc entries={toc} />
              </nav>
            </details>
          )}

          <div data-cms-body className={cn("mt-12 max-w-2xl", CMS_PROSE)}>
            <CmsDocument
              doc={data.body}
              anchors={outline.bodyAnchors}
              resolveImage={resolveImage}
              parentHost={parentHost}
            />
            {data.sections.map((section, index) => {
              const sectionOutline = outline.sections[index]!;
              return (
                <section key={sectionOutline.anchor} aria-labelledby={sectionOutline.anchor}>
                  <h2 id={sectionOutline.anchor} className="scroll-mt-24">
                    {section.title || "Untitled section"}
                  </h2>
                  <CmsDocument
                    doc={section.body}
                    anchors={sectionOutline.headingAnchors}
                    resolveImage={resolveImage}
                    parentHost={parentHost}
                  />
                </section>
              );
            })}
          </div>

          {(data.tags.length > 0 || data.authors.length > 0) && (
            <footer className="mt-16 max-w-2xl space-y-8 border-t border-border pt-8">
              {data.tags.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label="Tags">
                  {data.tags.map((tag) => (
                    <li key={tag} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                      {tag}
                    </li>
                  ))}
                </ul>
              )}
              {data.authors.length > 0 && (
                <ul className="space-y-4" aria-label="Written by">
                  {data.authors.map((author) => (
                    <li key={author.name} className="flex items-center gap-3 text-sm">
                      <AuthorAvatar author={author} />
                      <span>
                        <span className="block font-medium text-foreground">{author.name}</span>
                        {author.roleTitle && <span className="block text-muted-foreground">{author.roleTitle}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </footer>
          )}
        </div>

        {hasRail && (
          <aside className="hidden lg:block">
            <div className="sticky top-24 flex max-h-[calc(100dvh-7rem)] flex-col gap-10 overflow-y-auto overscroll-contain pb-6 [scrollbar-width:thin]">
              {hasFacts && <GuideFacts data={data} rail />}
              {showToc && (
                <nav aria-label="On this page">
                  <p className="mb-3 text-sm font-medium text-foreground">On this page</p>
                  <ArticleToc entries={toc} track />
                </nav>
              )}
              {related.length > 0 && (
                <nav aria-label="Related">
                  <p className="mb-3 text-sm font-medium text-foreground">Related</p>
                  <ul className="space-y-3 text-sm">
                    {related.map((link) => (
                      <li key={link.path}>
                        <Link
                          href={link.path}
                          className="group block rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                        >
                          <span className="block text-xs text-muted-foreground">
                            {link.type === "guide" ? "Guide" : "Blog"}
                          </span>
                          <span className="mt-0.5 block leading-snug text-foreground/85 transition-colors group-hover:text-foreground group-hover:underline group-hover:decoration-[var(--color-three)] group-hover:underline-offset-4">
                            {link.title}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}
              <a
                href="#top"
                className="inline-flex w-fit items-center gap-1.5 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              >
                <ArrowUp className="size-4" aria-hidden />
                Back to top
              </a>
            </div>
          </aside>
        )}
      </div>
    </article>
  );
}
