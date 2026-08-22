import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";
import { ClipsVods } from "@/components/public/home/clips-vods";
import { FinalCta } from "@/components/public/home/final-cta";

/*
 * First pass, same shape as /cloud-obs: a hero of its own, then the landing
 * page's section. Folder workflows, search in depth and the download formats
 * get their own copy later.
 */
export const metadata: Metadata = {
  title: "Twitch clip manager with folders",
  description:
    "Every clip from your Twitch channel, synced automatically and filed into folders you create. Search by title, category, or who clipped it, and download landscape or portrait.",
  alternates: { canonical: absoluteUrl("/clips") },
};

export default function ClipsPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <section className="pt-16 md:pt-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-amber-300">Clips</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              847 untagged clips. <br /> Not any more.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Your channel&apos;s clips sync themselves, then go where you put them. Folders you
              name, filters that stack, downloads in both shapes.
            </p>
          </div>
        </div>
      </section>
      <ClipsVods showProductLink={false} />
      <FinalCta />
    </div>
  );
}
