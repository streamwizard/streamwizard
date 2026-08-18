import type { LucideIcon } from "lucide-react";

/*
 * Below the hero the signal line continues down the page as a left spine, and
 * every pillar section hangs off it at a node. One grammar for the whole
 * scroll: the line is the page's spatial anchor, sections are its offshoots.
 */

export function Spine({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="absolute left-7 top-0 bottom-0 w-px signal-grad-y opacity-30 md:left-10" aria-hidden="true" />
      <div className="absolute left-7 top-0 bottom-0 w-px signal-grad-y signal-dash-y opacity-70 md:left-10" aria-hidden="true" />
      {children}
    </div>
  );
}

export function SpineSection({
  icon: Icon,
  tone,
  title,
  id,
  children,
  density = "regular",
}: {
  icon: LucideIcon;
  tone: string;
  title: string;
  id?: string;
  children: React.ReactNode;
  /** Pacing: "regular" sections breathe, "quiet" ones sit closer to the line. */
  density?: "regular" | "quiet";
}) {
  return (
    <section id={id} className={`relative scroll-mt-24 pl-16 pr-4 md:pl-24 md:pr-0 ${density === "quiet" ? "py-12" : "py-20"}`}>
      {/* Node on the spine. Solid background so it masks the line behind it. */}
      <span
        className={`absolute left-7 grid h-12 w-12 -translate-x-1/2 place-items-center rounded-xl border border-border bg-card md:left-10 ${tone} ${density === "quiet" ? "top-[3.35rem]" : "top-[5.35rem]"}`}
        aria-hidden="true"
      >
        <Icon className="h-5 w-5" />
      </span>
      <h2 className={`font-semibold tracking-tight text-foreground ${density === "quiet" ? "text-xl md:text-2xl" : "text-2xl md:text-4xl"}`}>
        {title}
      </h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}
