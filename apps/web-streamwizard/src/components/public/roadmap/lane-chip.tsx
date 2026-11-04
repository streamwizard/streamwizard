import { Reveal } from "@/components/public/home/reveal";

/* Lane marker sitting on the spine; bg-background masks the line behind it. */
export function LaneChip({ children, tone = "muted" }: { children: string; tone?: "muted" | "purple" }) {
  return (
    <Reveal className="pl-10 md:flex md:justify-center md:pl-0">
      <h2
        className={`inline-flex rounded-full border border-white/[0.08] bg-background px-3 py-1 font-mono text-xs uppercase tracking-widest ${
          tone === "purple" ? "text-purple-300" : "text-muted-foreground"
        }`}
      >
        {children}
      </h2>
    </Reveal>
  );
}
