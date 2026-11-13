import { TrackedLink } from "@/components/shared/tracked-link";
import { SmpDonePanel } from "@/components/public/smp/smp-done-panel";
import { SmpLinkDiscordButton } from "@/components/public/smp/smp-link-discord-button";
import { SmpLoginButton } from "@/components/public/smp/smp-login-button";
import { SmpRefreshButton } from "@/components/public/smp/smp-refresh-button";
import { SmpStep, type SmpStepStatus } from "@/components/public/smp/smp-step";
import { SmpWaitlistForm } from "@/components/public/smp/smp-waitlist-form";
import { discordInviteLink } from "@/lib/constant";
import type { SmpSignupState } from "@/server/smp/signup-state";

/*
 * The sign-up stepper. It is drawn from the state the server worked out
 * (server/smp/signup-state.ts): a step is marked done because it is true in
 * the database or on Discord, never because a button was clicked.
 */

const STEP_INDEX: Record<Exclude<SmpSignupState["step"], "done" | "unavailable">, number> = {
  signed_out: 0,
  link_discord: 1,
  join_discord: 2,
  form: 3,
};

export function SmpStepper({ state, discordRoleFailed = false }: { state: SmpSignupState; discordRoleFailed?: boolean }) {
  if (state.step === "done") {
    return (
      <div className="mx-auto max-w-3xl">
        <SmpDonePanel minecraftUsername={state.entry.minecraft_username} editable={state.entry.status === "pending"} />
      </div>
    );
  }

  if (state.step === "unavailable") {
    return (
      <div className="pixel-panel mx-auto max-w-3xl p-6 sm:p-8">
        <h3 className="pixel-shadow font-pixel text-xl font-medium text-white">Couldn&apos;t check your steps.</h3>
        <p className="mt-2 mb-4 text-sm text-foreground/90">
          You&apos;re signed in, but Discord or our database didn&apos;t answer. Nothing is lost.
        </p>
        <SmpRefreshButton label="Try again" primary />
      </div>
    );
  }

  const current = STEP_INDEX[state.step];
  const statusOf = (index: number): SmpStepStatus => (index < current ? "done" : index === current ? "current" : "locked");

  return (
    <ol className="mx-auto flex max-w-3xl flex-col gap-4">
      <SmpStep
        number={1}
        title="Create a StreamWizard account"
        description="Sign in with Twitch. You come straight back here."
        status={statusOf(0)}
      >
        {current === 0 && <SmpLoginButton />}
      </SmpStep>

      <SmpStep
        number={2}
        title="Link Discord"
        description="Connect the Discord account you'll use in our server."
        status={statusOf(1)}
      >
        {current === 1 && <SmpLinkDiscordButton />}
      </SmpStep>

      <SmpStep
        number={3}
        title="Join the StreamWizard Discord"
        description="Join with the account you linked. The Verified Member role lands by itself, then this step ticks off."
        status={statusOf(2)}
      >
        {current === 2 && (
          <div className="flex flex-col gap-4">
            {discordRoleFailed && (
              <p role="status" className="text-sm text-(--smp-gold)">
                Discord is linked, but the Verified Member role didn&apos;t land. Join the server and check again. Still
                stuck? Open a ticket in the Discord.
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <TrackedLink
                href={discordInviteLink}
                cta="join_discord"
                section="smp_join"
                target="_blank"
                rel="noopener noreferrer"
                className="pixel-btn pixel-btn-primary"
              >
                Open the invite
              </TrackedLink>
              <SmpRefreshButton label="I joined. Check again" />
            </div>
          </div>
        )}
      </SmpStep>

      <SmpStep
        number={4}
        title="Join the waitlist"
        description="Your Minecraft Java name and three things about your channel."
        status={statusOf(3)}
      >
        {state.step === "form" && <SmpWaitlistForm streamLanguage={state.streamLanguage} />}
      </SmpStep>
    </ol>
  );
}
