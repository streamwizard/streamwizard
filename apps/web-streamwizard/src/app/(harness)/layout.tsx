import { notFound } from "next/navigation";
import { env } from "@/lib/env";

/**
 * Screenshot harness for apps/docs.
 *
 * These routes mount the real renderers with fixture props, so the docs can
 * show what a widget looks like on stream without a database, a Twitch token,
 * or someone actually going live.
 *
 * They are committed rather than created per run on purpose: a route that is
 * added and deleted churns .next/dev/types and re-triggers Next's agent-file
 * writer, while a route that simply exists churns nothing.
 *
 * Never reachable in a deployed build, and off in ordinary local dev unless
 * DOCS_SHOTS=1 is set.
 */
export default function HarnessLayout({ children }: { children: React.ReactNode }) {
  if (env.NODE_ENV === "production" || env.DOCS_SHOTS !== "1") notFound();
  return <>{children}</>;
}
