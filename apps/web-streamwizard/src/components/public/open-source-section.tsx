import Link from "next/link";
import { Button } from "@repo/ui";
import { FaGithub, FaDiscord } from "react-icons/fa";
import { GitFork, Star, Scale, GitPullRequest } from "lucide-react";
import { githubLink, discordInviteLink } from "@/lib/constant";

const stats = [
  { icon: Star, label: "Star us", value: "GitHub" },
  { icon: GitFork, label: "Fork it", value: "Open Source" },
  { icon: GitPullRequest, label: "Contribute", value: "PRs welcome" },
  { icon: Scale, label: "License", value: "MIT" },
];

export function OpenSourceSection() {
  return (
    <section className="py-20">
      <div className="container px-4 mx-auto">
        {/* Outer card — group for hover glow lift */}
        <div className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">

          {/* Ambient glow blob — lifts toward center on hover (from 21st.dev CTA with Glow) */}
          <div className="pointer-events-none absolute inset-0 translate-y-[3rem] opacity-60 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-[1rem] group-hover:opacity-90">
            <div className="absolute left-1/2 top-1/2 h-[300px] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.18)_0%,transparent_70%)]" />
            <div className="absolute left-1/2 top-1/2 h-[150px] w-[40%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.12)_0%,transparent_60%)]" />
          </div>

          {/* Content — two-column on desktop */}
          <div className="relative z-10 flex flex-col gap-10 px-8 py-12 lg:flex-row lg:items-center lg:gap-16 lg:px-14 lg:py-16">

            {/* Left: text + CTAs */}
            <div className="flex flex-col gap-6 lg:flex-1">
              <div className="flex flex-col gap-3">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-300">
                  <FaGithub className="h-3 w-3" />
                  Open Source
                </div>
                <h2 className="text-3xl font-bold leading-tight sm:text-4xl">
                  Built in public.
                  <br />
                  <span className="text-muted-foreground font-normal">Contributions welcome.</span>
                </h2>
                <p className="text-muted-foreground max-w-md">
                  Fork it, report bugs, submit a PR, or just lurk the repo. StreamWizard is MIT licensed and open to everyone.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" className="gap-2 bg-white text-black hover:bg-white/90">
                  <Link href={githubLink} target="_blank" rel="noopener noreferrer">
                    <FaGithub className="h-4 w-4" />
                    View on GitHub
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="gap-2 border-white/10 hover:bg-white/5">
                  <Link href={discordInviteLink} target="_blank" rel="noopener noreferrer">
                    <FaDiscord className="h-4 w-4" />
                    Join Discord
                  </Link>
                </Button>
              </div>
            </div>

            {/* Right: stats grid */}
            <div className="grid grid-cols-2 gap-3 lg:w-72 lg:shrink-0">
              {stats.map(({ icon: Icon, label, value }) => (
                <div
                  key={label}
                  className="flex flex-col gap-2 rounded-xl border border-white/[0.07] bg-white/[0.04] p-4 transition-colors duration-200 hover:bg-white/[0.07]"
                >
                  <Icon className="h-5 w-5 text-purple-400" />
                  <span className="text-sm font-semibold text-foreground">{value}</span>
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
