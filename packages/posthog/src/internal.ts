const INTERNAL_EMAIL_DOMAINS = ["amrio.nl"];

// Whether an account is one of ours, judged by its email domain. The address
// itself is never sent to PostHog; only the resulting flag is.
export function isInternalEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const address = email.toLowerCase();
  return INTERNAL_EMAIL_DOMAINS.some((domain) => address.endsWith(`@${domain}`));
}
