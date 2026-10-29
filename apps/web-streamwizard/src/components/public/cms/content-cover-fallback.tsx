import { cn } from "@repo/ui";
import { Compass, Newspaper } from "lucide-react";
import type { ContentType } from "@repo/cms";

// The cover of a post without one: a dark surface with the brand glow behind
// it (branding.md: the gradient is a glow, never a fill), the type's icon and
// the category. Decorative; the card's title says what the post is.

const GLOWS = [
  "radial-gradient(70% 90% at 15% 0%, color-mix(in oklab, var(--color-three) 38%, transparent), transparent 70%), radial-gradient(60% 80% at 100% 100%, color-mix(in oklab, var(--color-two) 18%, transparent), transparent 70%)",
  "radial-gradient(70% 90% at 85% 0%, color-mix(in oklab, var(--color-three) 34%, transparent), transparent 70%), radial-gradient(60% 80% at 0% 100%, color-mix(in oklab, var(--color-one) 16%, transparent), transparent 70%)",
  "radial-gradient(80% 100% at 50% 110%, color-mix(in oklab, var(--color-three) 40%, transparent), transparent 70%), radial-gradient(50% 70% at 100% 0%, color-mix(in oklab, var(--color-two) 14%, transparent), transparent 70%)",
];

/** Same post, same glow: a cheap stable hash of its id. */
function glowFor(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return GLOWS[hash % GLOWS.length]!;
}

export function ContentCoverFallback({
  seed,
  type,
  label,
  className,
}: {
  seed: string;
  type: ContentType;
  label: string | null;
  className?: string;
}) {
  const Icon = type === "guide" ? Compass : Newspaper;
  return (
    <div
      aria-hidden
      className={cn("relative overflow-hidden bg-neutral-950", className)}
      style={{ backgroundImage: glowFor(seed) }}
    >
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.035)_1px,transparent_1px)] bg-[size:28px_28px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      <Icon
        strokeWidth={1.25}
        className="absolute right-[8%] top-1/2 size-[38%] max-h-28 max-w-28 -translate-y-1/2 text-white/[0.14] transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
      />
      {label && (
        <p className="absolute bottom-4 left-5 font-mono text-[11px] uppercase tracking-widest text-white/60">{label}</p>
      )}
    </div>
  );
}
