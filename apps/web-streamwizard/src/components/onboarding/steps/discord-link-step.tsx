"use client";

import { Check, CheckCircle2, ArrowUpRight } from "lucide-react";
import { FaDiscord } from "react-icons/fa";
import { discordDocsLink } from "@/lib/constant";

// Shows what linking is for. The button that does it ("Link Discord") is in
// the wizard's footer, next to Back and Skip, like every other step.
export function DiscordLinkStep({ linked }: { linked: boolean }) {
  if (linked) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">Discord&apos;s linked.</h2>
          <p className="text-sm text-muted-foreground">One step left. Join the server and your role shows up.</p>
        </div>
        <div className="relative rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
          <div className="absolute inset-x-0 top-0 h-px rounded-t-xl bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </span>
            <div>
              <p className="text-sm font-medium">Discord connected</p>
              <p className="text-xs text-muted-foreground">Next: join the server.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Link your Discord.</h2>
        <p className="text-sm text-muted-foreground">
          Takes ten seconds. It&apos;s how we know it&apos;s you when you ask for help.
        </p>
      </div>

      <div className="relative rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
        <div className="absolute inset-x-0 top-0 h-px rounded-t-xl bg-gradient-to-r from-transparent via-[#5865F2]/40 to-transparent" />
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#5865F2]/10 border border-[#5865F2]/20">
            <FaDiscord className="h-4 w-4 text-[#5865F2]" />
          </span>
          <div>
            <p className="text-sm font-medium">Your Discord account</p>
            <p className="text-xs text-muted-foreground">Just confirming it&apos;s you, no server stuff yet.</p>
          </div>
        </div>
      </div>

      <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
        <li className="flex items-start gap-2">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#5865F2]" />
          Go live and we post your stream in our Discord and give you the Live role. Switch it off in Settings any time
        </li>
        <li className="flex items-start gap-2">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#5865F2]" />
          Open a ticket and we already know which account is yours, no &ldquo;what&apos;s your username&rdquo; back and forth
        </li>
        <li className="flex items-start gap-2">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#5865F2]" />
          One-time link. We only ask for your Discord ID, nothing else
        </li>
      </ul>

      <a
        href={discordDocsLink}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-4 self-start hover:text-foreground"
      >
        Read all benefits
        <ArrowUpRight className="h-3 w-3" />
      </a>
    </div>
  );
}
