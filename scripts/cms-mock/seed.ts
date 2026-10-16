// MOCK DATA, local dev only.
//
//   bun run cms:mock          seed (or refresh) the mock posts and guides
//   bun run cms:mock:reset    remove them, then seed again
//   bun run cms:mock:remove   remove them
//
// Writes to the LOCAL Supabase through PostgREST with the service role. The
// URL and key come from `supabase status`, and the script stops unless the
// URL is localhost: it can never write to staging or production.
//
// Every row it makes has an id starting with 0000c0de-, so removal deletes
// exactly those. Categories and tags that already exist (same slug) are
// reused and never deleted; real posts are never touched. Posts are written
// as drafts, then published with cms_publish like the admin does, backdated
// so the index has a spread of dates.
//
// Optional env:
//   CMS_REVALIDATE_SECRET   refresh the running site's cache when done
//   CMS_MOCK_SITE_URL       where that site runs (default http://localhost:3000)

import { execFileSync } from "node:child_process";
import { extractText, pageOutline, readingStats, sanitizeDoc, type Doc } from "../../packages/cms/src/index";
import { MOCK_AUTHORS, MOCK_CATEGORIES, MOCK_CONTENT, MOCK_TAGS, type MockContent } from "./content";

const MOCK_PREFIX = "0000c0de-";
const KIND = { author: 1, category: 2, tag: 3, content: 4, section: 5 } as const;

function mockId(kind: keyof typeof KIND, n: number): string {
  return `${MOCK_PREFIX}000${KIND[kind]}-4000-8000-${n.toString(16).padStart(12, "0")}`;
}


// ─── Local Supabase only ────────────────────────────────────────────────────

function localSupabase(): { url: string; key: string } {
  let raw: string;
  try {
    raw = execFileSync("supabase", ["status", "-o", "env"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    throw new Error("`supabase status` failed. Is the local stack running? Try `supabase start`.");
  }
  const env = new Map<string, string>();
  for (const line of raw.split("\n")) {
    const match = line.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (match) env.set(match[1]!, match[2]!);
  }
  const url = env.get("API_URL");
  const key = env.get("SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("`supabase status` gave no API_URL or SERVICE_ROLE_KEY.");
  const host = new URL(url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(`Refusing to write mock data to ${host}. This script only runs against local Supabase.`);
  }
  return { url, key };
}

const { url: SUPABASE_URL, key: SERVICE_KEY } = localSupabase();

async function rest<T = unknown>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  prefer?: string,
): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path.split("?")[0]}: ${response.status} ${text}`);
  return (text ? JSON.parse(text) : null) as T;
}

const inList = (values: readonly string[]) => `in.(${values.map((v) => `"${v}"`).join(",")})`;

// ─── Ids for everything the mock data defines ───────────────────────────────

const authorIds = new Map(MOCK_AUTHORS.map((author, i) => [author.key, mockId("author", i + 1)]));
const contentIds = new Map(MOCK_CONTENT.map((item, i) => [`${item.type}:${item.slug}`, mockId("content", i + 1)]));
const allMockContentIds = [...contentIds.values()];
const allMockAuthorIds = [...authorIds.values()];
const allMockCategoryIds = MOCK_CATEGORIES.map((_, i) => mockId("category", i + 1));
const allMockTagIds = MOCK_TAGS.map((_, i) => mockId("tag", i + 1));

// ─── Remove ─────────────────────────────────────────────────────────────────

async function remove(): Promise<void> {
  // Cascades to the published copy, sections, joins, revisions and redirects.
  const content = await rest<{ id: string }[]>(
    "DELETE",
    `cms_content?id=${inList(allMockContentIds)}&select=id`,
    undefined,
    "return=representation",
  );

  // A real post written by a mock author (unlikely) blocks that author's removal.
  const authorsInUse = await rest<{ author_id: string }[]>(
    "GET",
    `cms_content_authors?author_id=${inList(allMockAuthorIds)}&select=author_id`,
  );
  const freeAuthors = allMockAuthorIds.filter((id) => !authorsInUse.some((row) => row.author_id === id));
  const authors = freeAuthors.length
    ? await rest<{ id: string }[]>("DELETE", `cms_authors?id=${inList(freeAuthors)}&select=id`, undefined, "return=representation")
    : [];

  // Mock categories and tags stay if a real post has started using them.
  const tagsInUse = await rest<{ tag_id: string }[]>("GET", `cms_content_tags?tag_id=${inList(allMockTagIds)}&select=tag_id`);
  const categoriesInUse = [
    ...(await rest<{ category_id: string }[]>(
      "GET",
      `cms_content_categories?category_id=${inList(allMockCategoryIds)}&select=category_id`,
    )).map((row) => row.category_id),
    ...(await rest<{ primary_category_id: string }[]>(
      "GET",
      `cms_content?primary_category_id=${inList(allMockCategoryIds)}&select=primary_category_id`,
    )).map((row) => row.primary_category_id),
  ];
  const freeTags = allMockTagIds.filter((id) => !tagsInUse.some((row) => row.tag_id === id));
  const freeCategories = allMockCategoryIds.filter((id) => !categoriesInUse.includes(id));
  const tags = freeTags.length
    ? await rest<{ id: string }[]>("DELETE", `cms_tags?id=${inList(freeTags)}&select=id`, undefined, "return=representation")
    : [];
  const categories = freeCategories.length
    ? await rest<{ id: string }[]>(
        "DELETE",
        `cms_categories?id=${inList(freeCategories)}&select=id`,
        undefined,
        "return=representation",
      )
    : [];

  console.log(
    `Removed ${content.length} posts/guides, ${authors.length} authors, ${categories.length} categories, ${tags.length} tags.`,
  );
  const kept = allMockTagIds.length - freeTags.length + (allMockCategoryIds.length - freeCategories.length);
  if (kept > 0) console.log(`Kept ${kept} mock categories/tags that real posts use.`);
}

// ─── Seed ───────────────────────────────────────────────────────────────────

/** slug → id for one taxonomy table: the existing row if there is one, else a new mock row. */
async function ensureTerms(
  table: "cms_categories" | "cms_tags",
  terms: readonly { slug: string; name: string; description?: string }[],
  ids: string[],
): Promise<Map<string, string>> {
  const existing = await rest<{ id: string; slug: string }[]>(
    "GET",
    `${table}?slug=${inList(terms.map((t) => t.slug))}&select=id,slug`,
  );
  const bySlug = new Map(existing.map((row) => [row.slug, row.id]));
  const missing = terms
    .map((term, i) => ({ term, id: ids[i]! }))
    .filter(({ term }) => !bySlug.has(term.slug))
    .map(({ term, id }, position) => ({
      id,
      slug: term.slug,
      name: term.name,
      ...(table === "cms_categories" ? { description: term.description ?? null, position } : {}),
    }));
  if (missing.length) await rest("POST", table, missing, "return=minimal");
  for (const row of missing) bySlug.set(row.slug, row.id);
  return bySlug;
}

function publishedAt(daysAgo: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  date.setUTCHours(15, 0, 0, 0);
  return date.toISOString();
}

/** What the admin's deriveDraft stores next to a body (apps/web-admin/src/lib/cms/draft.ts). */
function derive(item: MockContent) {
  const body = sanitizeDoc(item.body).doc;
  const sections = item.type === "guide" ? item.sections.map((s) => ({ title: s.title, body: sanitizeDoc(s.body).doc })) : [];
  const outline = pageOutline(body, sections);
  const stats = readingStats([body, ...sections.map((s) => s.body)]);
  return {
    body,
    body_text: extractText(body),
    toc: outline.toc,
    word_count: stats.words,
    reading_time_minutes: stats.minutes,
    sections: sections.map((section, index) => ({
      ...section,
      anchor: outline.sections[index]!.anchor,
      body_text: extractText(section.body as Doc),
    })),
  };
}

async function seed(): Promise<void> {
  // Start clean: a re-run replaces the mock posts instead of piling up.
  await rest("DELETE", `cms_content?id=${inList(allMockContentIds)}`);

  await rest(
    "POST",
    "cms_authors?on_conflict=id",
    MOCK_AUTHORS.map((author) => ({
      id: authorIds.get(author.key),
      slug: author.slug,
      name: author.name,
      role_title: author.role_title,
      bio: "Sample author for local development. Not a real person.",
    })),
    "resolution=merge-duplicates,return=minimal",
  );
  const categoryIds = await ensureTerms("cms_categories", MOCK_CATEGORIES, allMockCategoryIds);
  const tagIds = await ensureTerms("cms_tags", MOCK_TAGS, allMockTagIds);

  // Never take a slug a real post already has.
  const taken = new Set(
    (
      await rest<{ type: string; slug: string }[]>(
        "GET",
        `cms_content?slug=${inList(MOCK_CONTENT.map((item) => item.slug))}&deleted_at=is.null&select=type,slug`,
      )
    ).map((row) => `${row.type}:${row.slug}`),
  );
  const items = MOCK_CONTENT.filter((item) => {
    const key = `${item.type}:${item.slug}`;
    if (taken.has(key)) console.warn(`Skipped ${key}: a real post already uses that slug.`);
    return !taken.has(key);
  });

  const rows = [];
  const sectionRows = [];
  const authorRows = [];
  const categoryRows = [];
  const tagRows = [];
  let sectionCounter = 0;

  for (const item of items) {
    const id = contentIds.get(`${item.type}:${item.slug}`)!;
    const derived = derive(item);
    const guide = item.type === "guide";
    const categoryId = categoryIds.get(item.category)!;
    const date = publishedAt(item.daysAgo);
    rows.push({
      id,
      type: item.type,
      status: "draft",
      title: item.title,
      slug: item.slug,
      excerpt: item.excerpt,
      summary: item.summary,
      body: derived.body,
      body_text: derived.body_text,
      toc: derived.toc,
      word_count: derived.word_count,
      reading_time_minutes: derived.reading_time_minutes,
      primary_category_id: categoryId,
      is_featured: item.featured === true,
      pinned_rank: item.featured ? 1 : null,
      difficulty: guide ? item.difficulty : null,
      estimated_minutes: guide ? item.estimatedMinutes : null,
      prerequisites: guide ? item.prerequisites.map((text) => ({ text })) : [],
      // cms_publish keeps a first_published_at that's already set: that's the backdate.
      first_published_at: date,
      created_at: date,
    });
    derived.sections.forEach((section, position) => {
      sectionRows.push({
        id: mockId("section", ++sectionCounter),
        content_id: id,
        position,
        title: section.title,
        anchor: section.anchor,
        body: section.body,
        body_text: section.body_text,
      });
    });
    item.authors.forEach((key, position) => authorRows.push({ content_id: id, author_id: authorIds.get(key), position }));
    categoryRows.push({ content_id: id, category_id: categoryId });
    for (const tag of item.tags) tagRows.push({ content_id: id, tag_id: tagIds.get(tag) });
  }

  await rest("POST", "cms_content", rows, "return=minimal");
  if (sectionRows.length) await rest("POST", "cms_guide_sections", sectionRows, "return=minimal");
  await rest("POST", "cms_content_authors", authorRows, "return=minimal");
  await rest("POST", "cms_content_categories", categoryRows, "return=minimal");
  await rest("POST", "cms_content_tags", tagRows, "return=minimal");

  for (const row of rows) {
    await rest("POST", "rpc/cms_publish", {
      p_content_id: row.id,
      p_actor: null,
      p_expected_lock_version: 0,
      p_minor_edit: false,
    });
    // Publishing stamps "updated" as now; a mock post was last touched when it came out.
    await rest("PATCH", `cms_content?id=eq.${row.id}`, { content_updated_at: row.first_published_at }, "return=minimal");
    await rest(
      "PATCH",
      `cms_content_published?content_id=eq.${row.id}`,
      { content_updated_at: row.first_published_at },
      "return=minimal",
    );
  }

  const blogs = rows.filter((row) => row.type === "blog").length;
  console.log(`Published ${blogs} mock blog posts and ${rows.length - blogs} mock guides.`);
}

async function refreshSiteCache(): Promise<void> {
  const secret = process.env.CMS_REVALIDATE_SECRET;
  const site = process.env.CMS_MOCK_SITE_URL ?? "http://localhost:3000";
  if (!secret) {
    console.log("No CMS_REVALIDATE_SECRET: restart the dev server (or wait an hour) to see the changes.");
    return;
  }
  try {
    const response = await fetch(`${site}/api/revalidate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ tags: ["cms"], mode: "immediate" }),
    });
    console.log(response.ok ? `Refreshed the cache on ${site}.` : `Cache refresh on ${site} failed (${response.status}).`);
  } catch {
    console.log(`${site} isn't running. Its cache is fresh on the next start.`);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────
const mode = process.argv[2] ?? "seed";
if (!["seed", "reset", "remove"].includes(mode)) {
  console.error("Usage: bun scripts/cms-mock/seed.ts [seed|reset|remove]");
  process.exit(1);
}

try {
  if (mode === "remove" || mode === "reset") await remove();
  if (mode === "seed" || mode === "reset") await seed();
  await refreshSiteCache();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
