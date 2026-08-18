import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CLOUD_OBS_TIERS, DEFAULT_CURRENCY, formatPrice } from "@/components/public/pricing/plans";

/*
 * Quiet strip: real tier names from the plans table, placeholder prices. The
 * detail lives in the Cloud OBS page's pricing section. Checkout does not exist
 * yet, so the destination carries request-access CTAs, never a buy button.
 */
const TIERS = [
  { name: "Free", detail: "clips · overlays · analytics" },
  ...CLOUD_OBS_TIERS.map((tier) => ({
    name: `Cloud OBS ${tier.name}`,
    detail: `${formatPrice(tier.prices[DEFAULT_CURRENCY], DEFAULT_CURRENCY)} / month`,
  })),
];

export function PricingTeaser() {
  return (
    <div>
      <p className="max-w-xl text-base text-muted-foreground">
        The core toolkit is free forever. Cloud OBS runs on real hardware, so it comes in three tiers.
      </p>
      <ul className="mt-6 flex flex-wrap gap-3">
        {TIERS.map((tier) => (
          <li key={tier.name} className="rounded-lg border border-border bg-card px-4 py-3">
            <span className="block text-sm font-semibold text-foreground">{tier.name}</span>
            <span className="mt-0.5 block font-mono text-xs text-muted-foreground">{tier.detail}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/cloud-obs#pricing"
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline"
      >
        See what it costs
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
