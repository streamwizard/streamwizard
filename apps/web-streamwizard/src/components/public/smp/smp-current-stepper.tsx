import { SmpStepper } from "@/components/public/smp/smp-stepper";
import { loadCurrentSmpSignupState } from "@/server/smp/current-signup-state";

/* The stepper for a visitor with a session: reads their state on the server. Rendered inside Suspense. */
export async function SmpCurrentStepper({ discordRoleFailed }: { discordRoleFailed: boolean }) {
  const state = await loadCurrentSmpSignupState();
  return <SmpStepper state={state} discordRoleFailed={discordRoleFailed} />;
}
