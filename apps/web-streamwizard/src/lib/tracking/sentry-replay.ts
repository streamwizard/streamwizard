// Session Replay is the one Sentry feature that isn't error capture: it records
// (masked) DOM interactions for a sample of sessions, whether or not anything
// went wrong. That isn't strictly necessary to run the service, so it rides on
// the same consent as PostHog instead of starting on every page load. Error
// reports themselves are still captured regardless of the cookie choice.
//
// Called from the cookie banner on accept; instrumentation-client.ts adds the
// integration at init for visitors who already accepted on an earlier visit.
export async function enableSentryReplay(): Promise<void> {
  if (process.env.NODE_ENV === "development") return;
  const Sentry = await import("@sentry/nextjs");
  const client = Sentry.getClient();
  if (!client || client.getIntegrationByName("Replay")) return;
  Sentry.addIntegration(Sentry.replayIntegration());
}
