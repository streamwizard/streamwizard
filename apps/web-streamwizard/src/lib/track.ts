import { headers } from "next/headers";
import { configureTracking, isInternalEmail, trackServer, type AppEvent, type EventMap } from "@repo/posthog/server";
import { reportError } from "@repo/sentry";
import { createClient } from "@repo/supabase/next/server";

configureTracking({
  app: "web-streamwizard",
  onError: (error) => reportError(error, "posthog: server capture"),
});

interface TrackedUser {
  id: string;
  email?: string | null;
}

// Whoever the session cookie says is signed in. Never an id the browser sent
// along as an argument: that would let anyone file events under another
// account.
async function currentUser(): Promise<TrackedUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
}

// Records an account action from a server action or route handler. Pass `user`
// when the caller already has it; otherwise it is read from the session.
// Never throws: tracking must not fail the action it describes.
export async function track<E extends AppEvent>(
  event: E,
  properties: EventMap[E],
  user?: TrackedUser,
  options?: { relayed?: boolean },
): Promise<void> {
  try {
    const account = user ?? (await currentUser());
    if (!account) return;
    trackServer(account.id, event, properties, {
      request: { headers: await headers() },
      internal: isInternalEmail(account.email),
      relayed: options?.relayed,
    });
  } catch (error) {
    reportError(error, "posthog: track");
  }
}
