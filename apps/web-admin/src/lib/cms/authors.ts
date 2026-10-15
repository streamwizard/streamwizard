// Author profile fields that need checking beyond "is it a string". Pure, so
// the editor shows the same message the server action would return.

export const SOCIAL_LINKS = [
  { key: "twitch", label: "Twitch", hosts: ["twitch.tv"], placeholder: "https://twitch.tv/…" },
  { key: "youtube", label: "YouTube", hosts: ["youtube.com", "youtu.be"], placeholder: "https://youtube.com/@…" },
  { key: "x", label: "X", hosts: ["x.com", "twitter.com"], placeholder: "https://x.com/…" },
  { key: "bluesky", label: "Bluesky", hosts: ["bsky.app"], placeholder: "https://bsky.app/profile/…" },
  { key: "website", label: "Website", hosts: null, placeholder: "https://" },
] as const;

export type SocialLinkKey = (typeof SOCIAL_LINKS)[number]["key"];
export type SocialLinks = Partial<Record<SocialLinkKey, string>>;

export const MAX_BIO_LENGTH = 600;

function hostMatches(hostname: string, hosts: readonly string[]): boolean {
  const host = hostname.replace(/^www\./, "");
  return hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

/** Cleans the links (blank ones dropped). Returns the first problem, if any. */
export function parseSocialLinks(input: Record<string, string | undefined>): {
  links: SocialLinks;
  error: string | null;
} {
  const links: SocialLinks = {};
  for (const { key, label, hosts } of SOCIAL_LINKS) {
    const raw = input[key]?.trim();
    if (!raw) continue;
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return { links, error: `The ${label} link isn't a full URL. It should start with https://.` };
    }
    if (url.protocol !== "https:") return { links, error: `The ${label} link has to start with https://.` };
    if (hosts && !hostMatches(url.hostname, hosts)) return { links, error: `That isn't a ${label} link.` };
    links[key] = url.toString();
  }
  return { links, error: null };
}
