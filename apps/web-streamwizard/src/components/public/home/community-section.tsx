import Link from "next/link";
import { FaDiscord, FaGithub } from "react-icons/fa";
import { discordInviteLink, docsLink, githubLink } from "@/lib/constant";

/*
 * The umbrella pillar: open source is a fact of the product, stated with real
 * artifacts (MIT license, public repo, Discord, contribution docs) and no
 * invented numbers.
 */
const FACTS = [
  { label: "License", value: "MIT" },
  { label: "Code", value: "Public repo" },
  { label: "Roadmap", value: "Built in public" },
  { label: "Support", value: "Discord + docs" },
];

export function CommunitySection() {
  return (
    <div>
      <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
        The whole toolkit is MIT-licensed and built in the open. Read the code, file the issue, ship the widget.
      </p>

      <dl className="mt-8 grid max-w-2xl grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
        {FACTS.map((fact) => (
          <div key={fact.label} className="bg-card px-4 py-4">
            <dt className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{fact.label}</dt>
            <dd className="mt-1 text-sm font-semibold text-foreground">{fact.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Link
          href={githubLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-6 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <FaGithub className="h-4 w-4" aria-hidden="true" />
          View on GitHub
        </Link>
        <Link
          href={discordInviteLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-6 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          <FaDiscord className="h-4 w-4" aria-hidden="true" />
          Join Discord
        </Link>
        <Link
          href={`${docsLink}/contributing/first-contribution`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          Make your first contribution
        </Link>
      </div>
    </div>
  );
}
