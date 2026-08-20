import { BarChart3, Bell, Clapperboard, MonitorUp, PanelsTopLeft } from "lucide-react";
import { Reveal, RevealGroup } from "./reveal";

/*
 * The fragmented workflow vs the one-dashboard version. Same five jobs on
 * both sides, no competitor names, no invented numbers.
 */

const withoutItems = [
  "OBS pinned to the gaming PC, config backed up nowhere.",
  "Clips buried in the Twitch creator dashboard, sorted by nothing.",
  "An alerts tool with its own login and its own subscription.",
  "Stream stats copied into a spreadsheet after every stream.",
  "Five tabs open before you even hit go live.",
];

const withItems = [
  { icon: MonitorUp, text: "Cloud OBS for IRL, run from the deck on your phone." },
  { icon: Clapperboard, text: "Clips sync themselves and land in your folders." },
  { icon: Bell, text: "Alerts and overlays served from one browser source." },
  { icon: BarChart3, text: "Last stream analyzed the moment it ends." },
  { icon: PanelsTopLeft, text: "One tab. One login. Your Twitch account." },
];

export function WhyStreamwizard() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">Stream day should not need five tabs.</h2>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
              The usual setup
            </p>
            <RevealGroup
              className="space-y-3"
              items={withoutItems.map((text) => ({
                node: (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-muted-foreground">
                    {text}
                  </div>
                ),
              }))}
            />
          </div>

          <Reveal direction="scale">
            <div className="relative h-full overflow-hidden rounded-2xl border border-purple-500/25 bg-purple-500/[0.06] p-6">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
              <p className="mb-4 font-mono text-xs uppercase tracking-widest text-purple-300">
                One dashboard
              </p>
              <ul className="space-y-4">
                {withItems.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-purple-500/30 bg-purple-500/10">
                      <Icon className="h-3.5 w-3.5 text-purple-300" aria-hidden="true" />
                    </span>
                    <span className="text-sm leading-relaxed">{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
