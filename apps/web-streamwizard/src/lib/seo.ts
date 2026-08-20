import { discordInviteLink, githubLink } from "@/lib/constant";
import { env } from "@/lib/env";

/**
 * Single source of truth for what search engines may see.
 *
 * This is an explicit allowlist, not a filesystem crawl: every public route is
 * listed by hand so a new route under (protected) or (auth) can never leak into
 * the sitemap by accident.
 */
export type PublicRoute = {
  path: string;
  changeFrequency: "yearly" | "monthly" | "weekly" | "daily";
  priority: number;
  /** ISO date, or undefined to fall back to build time. */
  lastModified?: string;
};

export const PUBLIC_ROUTES: PublicRoute[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/privacy-policy", changeFrequency: "yearly", priority: 0.3, lastModified: "2026-05-26" },
  { path: "/terms-of-service", changeFrequency: "yearly", priority: 0.3, lastModified: "2026-05-26" },
];

/**
 * Paths that exist but must never be crawled: everything behind auth.
 *
 * /goodbye is deliberately absent. It needs to stay *out of the index* rather
 * than merely uncrawled, and a crawler blocked here could never read the
 * noindex tag that does that. It carries `robots: { index: false }` instead.
 */
export const DISALLOWED_PATHS = ["/api/", "/auth/", "/login", "/unauthorized", "/dashboard", "/deck", "/obs-viewer"];

/** The one host whose content is the real, indexable site. */
const CANONICAL_HOST = "streamwizard.org";
const CANONICAL_ORIGIN = `https://${CANONICAL_HOST}`;

/**
 * The env schema types this as a required URL, but `SKIP_ENV_VALIDATION` turns
 * validation off entirely — which is how CI builds, with no Doppler secrets. So
 * at build time this really can be undefined, whatever the type says.
 */
function configuredBaseUrl(): string | undefined {
  const raw = env.NEXT_PUBLIC_BASE_URL as string | undefined;
  if (!raw) return undefined;
  try {
    new URL(raw);
    return raw;
  } catch {
    return undefined;
  }
}

/**
 * Base URL for building absolute links. Falls back to the canonical origin so a
 * secret-less build still produces valid metadata instead of throwing on
 * `new URL(undefined)`.
 */
export function siteUrl(): string {
  return configuredBaseUrl() ?? CANONICAL_ORIGIN;
}

/**
 * Staging and local both run this same code with a different NEXT_PUBLIC_BASE_URL,
 * so the host decides indexability. No extra env var to forget to set — pointing
 * an environment at a non-prod domain is itself the signal to stay out of the index.
 *
 * Note this deliberately does NOT use siteUrl(): an unset base URL must read as
 * "not the production site", or a misconfigured deploy would inherit the
 * fallback origin and advertise itself as indexable.
 */
export function isIndexableEnvironment(): boolean {
  const configured = configuredBaseUrl();
  if (!configured) return false;
  return new URL(configured).hostname === CANONICAL_HOST;
}

/** Absolute URL for a public path, built off the environment's own base URL. */
export function absoluteUrl(path: string): string {
  return new URL(path, siteUrl()).toString();
}

/**
 * Sitewide publisher identity. Rendered once in the public layout; every other
 * schema block references it by @id rather than repeating the organization.
 */
export function organizationSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": absoluteUrl("/#organization"),
    name: "StreamWizard",
    url: absoluteUrl("/"),
    logo: absoluteUrl("/logo.png"),
    sameAs: [discordInviteLink, githubLink],
  };
}

/** The product itself: what AI answers and rich results read to describe us. */
export function softwareApplicationSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "StreamWizard",
    url: absoluteUrl("/"),
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    description:
      "Cloud OBS for IRL streaming, overlays, clip management, and stream analytics for Twitch streamers. Open source and built in public.",
    publisher: { "@id": absoluteUrl("/#organization") },
    // Free and MIT licensed, so the price is genuinely zero rather than a trial.
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    license: "https://opensource.org/licenses/MIT",
  };
}
