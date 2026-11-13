import { Suspense } from "react";
import { SmpCurrentStepper } from "@/components/public/smp/smp-current-stepper";
import { SmpSection } from "@/components/public/smp/smp-section";
import { SmpStepper } from "@/components/public/smp/smp-stepper";
import { SmpStepperSkeleton } from "@/components/public/smp/smp-stepper-skeleton";
import { hasSessionCookie } from "@/lib/auth";

/*
 * "How to join": the stepper, under the #join anchor the hero button and the
 * sign-in and Discord round trips come back to.
 *
 * A visitor without a session cookie gets the four steps straight away, with
 * no call to Supabase or Discord, so crawlers and first-time visitors see the
 * steps as text. With a cookie, the real state streams in behind a skeleton
 * and the rest of the page does not wait for it.
 */
export async function SmpJoinSection({ discordRoleFailed }: { discordRoleFailed: boolean }) {
  const maybeSignedIn = await hasSessionCookie();

  return (
    <SmpSection
      id="join"
      section="smp_join"
      eyebrow="How to join"
      title="Four steps to the waitlist."
      lede="Each step ticks off by itself once it's true. Come back any time and pick up where you left off."
    >
      {maybeSignedIn ? (
        <Suspense fallback={<SmpStepperSkeleton />}>
          <SmpCurrentStepper discordRoleFailed={discordRoleFailed} />
        </Suspense>
      ) : (
        <SmpStepper state={{ step: "signed_out" }} />
      )}
    </SmpSection>
  );
}
