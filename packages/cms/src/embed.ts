// Embeds are stored as { provider, id }. The editor turns a pasted URL into
// that pair with parseEmbedUrl; the renderer builds the iframe URL from it.
// Raw iframe markup never enters the document.

export const EMBED_PROVIDERS = ["youtube", "twitch_clip", "twitch_video"] as const;
export type EmbedProvider = (typeof EMBED_PROVIDERS)[number];

export interface Embed {
  provider: EmbedProvider;
  id: string;
}

const ID_PATTERNS: Record<EmbedProvider, RegExp> = {
  youtube: /^[A-Za-z0-9_-]{11}$/,
  twitch_clip: /^[A-Za-z0-9_-]{1,100}$/,
  twitch_video: /^\d{1,12}$/,
};

export function isEmbedProvider(value: unknown): value is EmbedProvider {
  return typeof value === "string" && (EMBED_PROVIDERS as readonly string[]).includes(value);
}

export function isValidEmbedId(provider: EmbedProvider, id: string): boolean {
  return ID_PATTERNS[provider].test(id);
}

function embed(provider: EmbedProvider, id: string | undefined | null): Embed | null {
  return id && isValidEmbedId(provider, id) ? { provider, id } : null;
}

// youtube.com/watch?v=, youtu.be/, /shorts/, /embed/, /live/; clips.twitch.tv/
// and twitch.tv/<channel>/clip/; twitch.tv/videos/. Anything else is null.
export function parseEmbedUrl(raw: string): Embed | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^(www|m)\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "youtu.be") return embed("youtube", parts[0]);
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (parts[0] === "watch") return embed("youtube", url.searchParams.get("v"));
    if (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live") return embed("youtube", parts[1]);
    return null;
  }
  if (host === "clips.twitch.tv")
    return parts[0] === "embed" ? embed("twitch_clip", url.searchParams.get("clip")) : embed("twitch_clip", parts[0]);
  if (host === "twitch.tv") {
    if (parts[0] === "videos") return embed("twitch_video", parts[1]);
    if (parts[1] === "clip") return embed("twitch_clip", parts[2]);
  }
  return null;
}

// The iframe URL for an embed. Twitch refuses to play inside a page unless
// the page's hostname is passed as `parent`.
export function embedSrc(embed: Embed, parentHost: string): string {
  const parent = encodeURIComponent(parentHost);
  switch (embed.provider) {
    case "youtube":
      return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(embed.id)}`;
    case "twitch_clip":
      return `https://clips.twitch.tv/embed?clip=${encodeURIComponent(embed.id)}&parent=${parent}&autoplay=false`;
    case "twitch_video":
      return `https://player.twitch.tv/?video=${encodeURIComponent(embed.id)}&parent=${parent}&autoplay=false`;
  }
}
