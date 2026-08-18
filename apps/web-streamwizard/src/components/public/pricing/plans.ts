/*
 * The Cloud OBS plans, rendered on /cloud-obs (there is no separate pricing
 * page: the plans sit with the product they price).
 * Tier names and limits are the real plans from the products/plans tables.
 * PRICES ARE MOCKS. Nothing charges them: there is no self-serve checkout, so
 * every CTA is request-access. Replace them the moment Stripe enforces a
 * number.
 *
 * Adding a currency: one entry in CURRENCIES plus one amount per tier. The
 * switcher and every formatted price follow from that, no component edits.
 */

export type CurrencyCode = "EUR" | "USD";

export type Currency = {
  code: CurrencyCode;
  /** Locale that formats this currency symbol-first, e.g. €11 rather than 11 €. */
  locale: string;
};

export const CURRENCIES: Currency[] = [
  { code: "EUR", locale: "en-IE" },
  { code: "USD", locale: "en-US" },
];

export const DEFAULT_CURRENCY: CurrencyCode = "EUR";

export function isCurrencyCode(value: string): value is CurrencyCode {
  return CURRENCIES.some((currency) => currency.code === value);
}

export type CloudObsTier = {
  name: string;
  resolution: string;
  fps: string;
  /** Mock monthly amount per currency. Not charged by anything. */
  prices: Record<CurrencyCode, number>;
  highlighted?: boolean;
};

export const CLOUD_OBS_TIERS: CloudObsTier[] = [
  { name: "720p30", resolution: "1280 × 720", fps: "30 fps", prices: { EUR: 11, USD: 12 } },
  { name: "1080p30", resolution: "1920 × 1080", fps: "30 fps", prices: { EUR: 17, USD: 18 }, highlighted: true },
  { name: "1080p60", resolution: "1920 × 1080", fps: "60 fps", prices: { EUR: 27, USD: 29 } },
];

/** In every Cloud OBS tier, whatever the output quality. */
export const CLOUD_OBS_INCLUDED = [
  "Bonded SRT/SRTLA ingest",
  "Auto scene-switcher",
  "The deck (phone remote)",
  "IRL overlays (walking stats included)",
  "Media library (1 GB)",
];

/** Whole amounts only: these are round mock prices, not 11.00 invoices. */
export function formatPrice(amount: number, code: CurrencyCode): string {
  const currency = CURRENCIES.find((entry) => entry.code === code) ?? CURRENCIES[0];
  return new Intl.NumberFormat(currency.locale, {
    style: "currency",
    currency: currency.code,
    maximumFractionDigits: 0,
  }).format(amount);
}
