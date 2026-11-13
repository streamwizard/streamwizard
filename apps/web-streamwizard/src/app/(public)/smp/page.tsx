import type { Metadata } from "next";
import { JsonLd } from "@/components/public/seo/json-ld";
import {
  SMP_FAQ_ITEMS,
  SMP_REQUIREMENTS,
  SMP_STREAMER_FEATURES,
  SMP_VIEWER_FEATURES,
} from "@/components/public/smp/smp-content";
import { SmpFaqSection } from "@/components/public/smp/smp-faq-section";
import { SmpFeatureSection } from "@/components/public/smp/smp-feature-section";
import { SmpHero } from "@/components/public/smp/smp-hero";
import { SmpJoinSection } from "@/components/public/smp/smp-join-section";
import { absoluteUrl, breadcrumbSchema, faqPageSchema } from "@/lib/seo/seo";
import { discordRoleNoticeSchema } from "@/schemas/smp";

/*
 * The StreamWizard Minecraft SMP: what the server is, and the sign-up that
 * ends on the waitlist. Hero, what viewers can do, what streamers get, the
 * stepper, what you need to play, FAQ. The copy lives in
 * components/public/smp/smp-content.ts; the themed look in the layout next to
 * this file.
 */
export const metadata: Metadata = {
  title: "Minecraft SMP for Twitch streamers",
  description:
    "A survival Minecraft server where viewers hit you with jumpscares, disasters and loot crates through Twitch redeems. Applications are open. Join the waitlist.",
  alternates: { canonical: absoluteUrl("/smp") },
};

export default async function SmpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Set by the Discord callback when the account linked but the role did not land.
  const discordRole = discordRoleNoticeSchema.safeParse((await searchParams).discordRole);
  const discordRoleFailed = discordRole.success && discordRole.data === "failed";

  return (
    <>
      <JsonLd schema={breadcrumbSchema("Minecraft SMP", "/smp")} />
      <JsonLd schema={faqPageSchema(SMP_FAQ_ITEMS)} />
      <SmpHero />
      <SmpFeatureSection
        id="viewers"
        section="smp_viewers"
        eyebrow="What viewers can do"
        title="Chat gets the controls."
        lede="Every one of these is a Twitch redeem, and every one of them lands on you."
        features={SMP_VIEWER_FEATURES}
      />
      <SmpFeatureSection
        id="streamers"
        section="smp_streamers"
        eyebrow="What streamers get"
        title="You get a few things back."
        lede="A place to hide, things to fire, and two neighbours you didn't ask for."
        features={SMP_STREAMER_FEATURES}
      />
      <SmpJoinSection discordRoleFailed={discordRoleFailed} />
      <SmpFeatureSection
        id="requirements"
        section="smp_requirements"
        eyebrow="What you need to play"
        title="Three things on your side."
        features={SMP_REQUIREMENTS}
      />
      <SmpFaqSection />
    </>
  );
}
