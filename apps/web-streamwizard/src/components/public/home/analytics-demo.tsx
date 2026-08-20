import { Clock, Eye, Star, Tv, UserPlus, Users } from "lucide-react";
import TwitchLogin from "@/components/buttons/twitch-login";
import { StatCard } from "@/components/stream/StatsRow/StatCard";
import { Reveal } from "./reveal";
import { AnalyticsDemoPanels } from "./analytics-demo-panels";
import { demoStats } from "./demo-data";

/*
 * The real dashboard, rendered on the landing page with one demo stream.
 * Labels, icons, and layout mirror /dashboard exactly; only the data is
 * synthetic, and the frame says so.
 */
export function AnalyticsDemo() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-300">
            Stream Analytics
          </span>
          <h2 className="mt-4 text-3xl font-bold sm:text-4xl">Last stream, explained.</h2>
          <p className="mt-4 text-muted-foreground">
            Your latest broadcast, minute by minute. Follows, subs, and clips land on the viewer
            graph, and the best hour gets called out.
          </p>
        </div>

        <Reveal>
          <div className="relative rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-6">
            <span className="absolute right-4 top-4 z-10 rounded-full border border-border bg-background/80 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:right-6 sm:top-6">
              Demo data
            </span>

            <div className="grid grid-cols-2 gap-3 pt-8 sm:grid-cols-3 sm:pt-0 lg:grid-cols-6">
              <StatCard icon={Tv} label="Time in ads" value={demoStats.timeInAds} />
              <StatCard
                icon={Eye}
                label="Peak viewers"
                value={demoStats.peakViewers}
                trend={{ direction: "up", label: "+31 from last stream" }}
              />
              <StatCard
                icon={Users}
                label="Avg. viewers"
                value={demoStats.avgViewers}
                trend={{ direction: "up", label: "+12 from last stream" }}
              />
              <StatCard icon={Clock} label="On air" value={demoStats.onAir} />
              <StatCard
                icon={UserPlus}
                label="New follows"
                value={demoStats.newFollows}
                trend={{ direction: "up", label: "+6 from last stream" }}
              />
              <StatCard
                icon={Star}
                label="New subs"
                value={demoStats.newSubs}
                trend={{ direction: "up", label: "+2 from last stream" }}
              />
            </div>

            <div className="mt-4">
              <AnalyticsDemoPanels />
            </div>
          </div>
        </Reveal>

        <div className="mt-12 flex flex-col items-center gap-3">
          <TwitchLogin
            redirect="/dashboard"
            text="Connect Twitch"
            variant="default"
            size="lg"
            source="landing_analytics"
          />
          <p className="text-sm text-muted-foreground">See your own last stream in about a minute.</p>
        </div>
      </div>
    </section>
  );
}
