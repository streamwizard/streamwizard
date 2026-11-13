import type { ReactNode } from "react";
import { SectionView } from "@/components/public/analytics/section-view";

/*
 * The frame every section of /smp shares: an anchor, the scroll-funnel marker,
 * and a heading block with the title in the pixel font. Body text stays in the
 * site's own font.
 */
export function SmpSection({
  id,
  section,
  eyebrow,
  title,
  lede,
  children,
}: {
  id: string;
  /** Name in the `section_viewed` event. */
  section: string;
  eyebrow: string;
  title: string;
  lede?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 py-16 md:py-20">
      <SectionView section={section} className="container mx-auto px-4">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className="font-pixel text-sm tracking-widest text-(--smp-lavender) uppercase">{eyebrow}</p>
          <h2 className="pixel-shadow mt-3 font-pixel text-3xl font-semibold text-white sm:text-4xl">{title}</h2>
          {lede && <p className="mt-4 text-muted-foreground">{lede}</p>}
        </div>
        {children}
      </SectionView>
    </section>
  );
}
