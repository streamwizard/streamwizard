"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { FaDiscord } from "react-icons/fa";
import { CLOUD_OBS_INCLUDED, CLOUD_OBS_TIERS, formatPrice } from "@/components/public/pricing/plans";
import { useCurrency } from "@/components/public/pricing/use-currency";
import { discordInviteLink } from "@/lib/constant";

/*
 * What Cloud OBS costs, on the Cloud OBS page. Only this product: the free
 * toolkit is the homepage's job. Prices stay placeholders until checkout
 * exists, so every CTA is request-access. The currency switcher renders from
 * CURRENCIES, so a new currency needs no change here.
 */

export function CloudObsPlans() {
  const { currency, setCurrency, currencies } = useCurrency();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
          Every tier is the same product. The only thing that changes is what your OBS puts out.
        </p>

        {currencies.length > 1 ? (
          <div className="inline-flex rounded-md border border-border p-0.5" role="group" aria-label="Currency">
            {currencies.map((entry) => (
              <button
                key={entry.code}
                type="button"
                onClick={() => setCurrency(entry.code)}
                aria-pressed={entry.code === currency}
                className={`rounded px-3 py-1 font-mono text-xs uppercase tracking-widest transition-colors ${
                  entry.code === currency ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {entry.code}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {CLOUD_OBS_TIERS.map((tier) => (
          <div
            key={tier.name}
            className={`flex flex-col rounded-xl border bg-card p-5 ${tier.highlighted ? "border-[#9e7aff]/60" : "border-border"}`}
          >
            <h4 className="text-base font-semibold text-foreground">{tier.name}</h4>
            <p className="mt-1 font-mono text-2xl font-semibold text-foreground">
              {formatPrice(tier.prices[currency], currency)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">/ month</span>
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {tier.resolution} · {tier.fps}
            </p>
            <ul className="mt-5 flex-1 space-y-2.5">
              {CLOUD_OBS_INCLUDED.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#4ade80]" aria-hidden="true" />
                  {feature}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Link
                href={discordInviteLink}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex h-9 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors ${
                  tier.highlighted
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border border-border text-foreground hover:bg-accent"
                }`}
              >
                <FaDiscord className="h-4 w-4" aria-hidden="true" />
                Request access
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
