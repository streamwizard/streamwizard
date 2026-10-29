import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { CmsArticle } from "@/components/public/cms/cms-article";
import { PreviewScrollKeeper } from "@/components/public/cms/preview-scroll-keeper";
import { imageResolver } from "@/lib/cms/images";
import { loadPreview } from "@/lib/cms/preview";

// A draft blog post or guide, for whoever has the link. Never indexed, never
// cached, never tracked (PostHog drops events here; see @repo/posthog scrub),
// and the token stays out of Referer headers (next.config.ts).

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Draft preview",
  robots: { index: false, follow: false, nocache: true },
};

export default async function PreviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const preview = await loadPreview(token);
  if (preview.state === "missing") notFound();

  if (preview.state !== "active") {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold">This preview link stopped working</h1>
        <p className="mt-3 text-muted-foreground">
          {preview.state === "expired" ? "It expired." : "It was turned off."} Ask whoever sent it for a new one.
        </p>
      </div>
    );
  }

  const host = ((await headers()).get("host") ?? "streamwizard.org").replace(/:\d+$/, "");
  return (
    <>
      <div
        role="status"
        className="border-b border-amber-400/30 bg-amber-400/10 px-4 py-2 text-center text-sm text-foreground"
      >
        Draft preview. This isn&apos;t published, and only people with this link can see it.
      </div>
      <CmsArticle data={preview.article} resolveImage={imageResolver(preview.assets)} parentHost={host} />
      <PreviewScrollKeeper token={token} />
    </>
  );
}
