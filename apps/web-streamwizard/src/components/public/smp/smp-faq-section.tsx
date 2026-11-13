import { FaqAccordion } from "@/components/public/home/faq-accordion";
import { SMP_FAQ_ITEMS } from "@/components/public/smp/smp-content";
import { SmpSection } from "@/components/public/smp/smp-section";

/* The site's own FAQ list, in the site's own font: answers are for reading. */
export function SmpFaqSection() {
  return (
    <SmpSection id="faq" section="smp_faq" eyebrow="FAQ" title="Before you craft a Rift Key.">
      <div className="mx-auto max-w-3xl">
        <FaqAccordion items={SMP_FAQ_ITEMS} />
      </div>
    </SmpSection>
  );
}
