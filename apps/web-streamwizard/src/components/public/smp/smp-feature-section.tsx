import { PixelSprite } from "@/components/public/smp/pixel-sprite";
import type { SmpFeature } from "@/components/public/smp/smp-content";
import { SmpSection } from "@/components/public/smp/smp-section";

/*
 * A grid of menu panels, one per feature. "What viewers can do", "what
 * streamers get" and "what you need to play" are the same section with
 * different data from smp-content.ts.
 */
export function SmpFeatureSection({
  features,
  ...section
}: {
  id: string;
  section: string;
  eyebrow: string;
  title: string;
  lede?: string;
  features: readonly SmpFeature[];
}) {
  return (
    <SmpSection {...section}>
      {/* Flex, not grid: a last row that is not full sits in the middle instead of hanging left. */}
      <ul className="mx-auto flex max-w-5xl flex-wrap justify-center gap-4">
        {features.map((feature) => (
          <li
            key={feature.title}
            className="pixel-panel flex w-full flex-col gap-3 p-6 sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.667rem)]"
          >
            {feature.sprites && (
              <div className="flex flex-wrap gap-2" aria-hidden="true">
                {feature.sprites.map((sprite) => (
                  <PixelSprite key={sprite} sprite={sprite} />
                ))}
              </div>
            )}
            <h3 className="pixel-shadow font-pixel text-xl font-medium text-(--smp-gold)">{feature.title}</h3>
            <p className="text-sm leading-relaxed text-foreground/90">{feature.text}</p>
            {feature.code && (
              <code className="mt-auto block border-2 border-(--smp-ink) bg-black/40 px-3 py-2 font-mono text-sm break-all text-white">
                {feature.code}
              </code>
            )}
          </li>
        ))}
      </ul>
    </SmpSection>
  );
}
