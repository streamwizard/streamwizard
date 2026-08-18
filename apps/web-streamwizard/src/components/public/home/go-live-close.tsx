import TwitchLogin from "@/components/buttons/twitch-login";

/*
 * The close: the spine converges to a single terminal dot and the page ends on
 * the one action that matters. Quiet, anchored, no restated feature list.
 */
export function GoLiveClose() {
  return (
    <section className="relative pb-28 pt-8">
      {/* The line's terminal */}
      <div className="mx-auto h-16 w-px signal-grad-y opacity-60" aria-hidden="true" />
      <div className="mx-auto -mt-1 h-2.5 w-2.5 rounded-full bg-[#4ade80]" aria-hidden="true" />

      <div className="container mx-auto mt-10 px-4 text-center">
        <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Go stream something. We will keep the rest running.
        </h2>
        <div className="mt-8 flex justify-center">
          <TwitchLogin redirect="/dashboard" text="Connect Twitch" variant="default" size="lg" source="home-close" />
        </div>
      </div>
    </section>
  );
}
