import Image from "next/image";
import { pageOutline, type Doc } from "@repo/cms";
import { DIFFICULTY_LABELS, LONG_DATE } from "@/lib/cms/published";
import { CMS_PROSE, CmsDocument, type ResolvedImage } from "./cms-document";

// One blog post or guide, laid out for reading. The draft preview and the
// published pages both use it, so a preview looks like the real thing.

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
  sections: { title: string; body: Doc }[];
}

function formatDate(iso: string): string {
  return LONG_DATE.format(new Date(iso));
}

interface CmsArticleProps {
  data: ArticleData;
  resolveImage: (attrs: Record<string, unknown>) => ResolvedImage | null;
  parentHost: string;
}

export function CmsArticle({ data, resolveImage, parentHost }: CmsArticleProps) {
  const guide = data.type === "guide";
  const outline = pageOutline(data.body, data.sections);
  const showToc = guide ? outline.toc.length > 1 : outline.toc.length >= 3;
  const byline = data.authors.map((author) => author.name).join(", ");
  const updated = data.updatedAt && data.publishedAt && data.updatedAt.slice(0, 10) !== data.publishedAt.slice(0, 10);

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="space-y-5">
        {data.categories.length > 0 && (
          <p className="text-sm font-medium text-muted-foreground">{data.categories.join(" · ")}</p>
        )}
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">{data.title || "Untitled"}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          {data.authors.length > 0 && (
            <span className="flex items-center gap-2">
              <span className="flex -space-x-2">
                {data.authors.map((author) =>
                  author.avatarUrl ? (
                    <Image
                      key={author.name}
                      src={author.avatarUrl}
                      alt=""
                      width={28}
                      height={28}
                      className="size-7 rounded-full border-2 border-background object-cover"
                    />
                  ) : null,
                )}
              </span>
              <span className="text-foreground">{byline}</span>
            </span>
          )}
          {data.publishedAt && <time dateTime={data.publishedAt}>{formatDate(data.publishedAt)}</time>}
          {updated && data.updatedAt && (
            <span>
              Updated <time dateTime={data.updatedAt}>{formatDate(data.updatedAt)}</time>
            </span>
          )}
          <span>{data.readingMinutes} min read</span>
        </div>
      </header>

      {guide && (data.difficulty || data.estimatedMinutes || data.prerequisites.length > 0) && (
        <dl className="mt-8 grid gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 text-sm sm:grid-cols-3">
          {data.difficulty && (
            <div>
              <dt className="text-muted-foreground">Level</dt>
              <dd className="mt-1 font-medium">{DIFFICULTY_LABELS[data.difficulty]}</dd>
            </div>
          )}
          {data.estimatedMinutes && (
            <div>
              <dt className="text-muted-foreground">Takes about</dt>
              <dd className="mt-1 font-medium">{data.estimatedMinutes} min</dd>
            </div>
          )}
          {data.prerequisites.length > 0 && (
            <div className="sm:col-span-3">
              <dt className="text-muted-foreground">Before you start</dt>
              <dd className="mt-1">
                <ul className="list-disc space-y-1 pl-5">
                  {data.prerequisites.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </dd>
            </div>
          )}
        </dl>
      )}

      {data.summary && (
        <p className="mt-8 border-l-2 border-[var(--color-three)] pl-5 text-lg leading-8 text-foreground">
          {data.summary}
        </p>
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
              sizes="(min-width: 768px) 768px, 100vw"
              className="h-auto w-full rounded-2xl border border-white/[0.08]"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- no stored size to give next/image
            <img
              src={data.cover.src}
              alt={data.cover.alt}
              className="h-auto w-full rounded-2xl border border-white/[0.08]"
            />
          )}
        </figure>
      )}

      {showToc && (
        <nav
          aria-label="On this page"
          className="mt-10 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 text-sm"
        >
          <p className="font-medium">On this page</p>
          <ol className="mt-3 space-y-1.5">
            {outline.toc.map((entry) => (
              <li key={entry.anchor} style={{ paddingLeft: `${(entry.level - 2) * 1}rem` }}>
                <a href={`#${entry.anchor}`} className="text-muted-foreground hover:text-foreground">
                  {entry.text || "Untitled section"}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div data-cms-body className={`mt-10 ${CMS_PROSE}`}>
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

      {data.tags.length > 0 && (
        <ul className="mt-12 flex flex-wrap gap-2" aria-label="Tags">
          {data.tags.map((tag) => (
            <li key={tag} className="rounded-full border border-white/[0.1] px-3 py-1 text-xs text-muted-foreground">
              {tag}
            </li>
          ))}
        </ul>
      )}

      {data.authors.some((author) => author.roleTitle) && (
        <footer className="mt-12 space-y-3 border-t border-white/[0.08] pt-8 text-sm">
          {data.authors.map((author) => (
            <p key={author.name}>
              <span className="font-medium text-foreground">{author.name}</span>
              {author.roleTitle && <span className="text-muted-foreground"> · {author.roleTitle}</span>}
            </p>
          ))}
        </footer>
      )}
    </article>
  );
}
