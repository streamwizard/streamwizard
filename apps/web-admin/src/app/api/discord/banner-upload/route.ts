import { NextResponse } from "next/server";
import { DISCORD_LIMITS, sniffBannerImageType, validateBannerImage } from "@repo/discord-message";
import { reportError } from "@repo/sentry";
import { assertAdmin } from "@/lib/assert-admin";
import { getDiscordContext } from "@/lib/discord/api";
import { bannerUploadsEnabled, storeBannerImage } from "@/lib/discord/banner-storage";

// Banner image upload for the Discord message builder. A route handler and not
// a server action: actions cap their body at 1 MB, banners go up to 10. The
// file goes through the server instead of a presigned URL, so the bucket needs
// no CORS rule for this origin and the CSP needs no R2 entry.
export const dynamic = "force-dynamic";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(request: Request) {
  // Session cookies are SameSite=Lax already; this is the belt to that pair of braces.
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return fail("Not authorized", 403);

  try {
    await assertAdmin();
  } catch {
    return fail("Not authorized", 403);
  }
  const discord = getDiscordContext();
  if (!discord || !bannerUploadsEnabled()) return fail("Image uploads aren't set up here.", 503);

  // Refuse oversized bodies before reading them. 64 KB of slack for the multipart framing.
  if (Number(request.headers.get("content-length") ?? 0) > DISCORD_LIMITS.imageBytes + 65_536) {
    return fail("That image is too big. Discord allows 10 MB.", 413);
  }

  const file = (await request.formData().catch(() => null))?.get("file");
  if (!(file instanceof File)) return fail("No image in the upload.", 400);

  const [issue] = validateBannerImage(file);
  if (issue) return fail(issue.message, 400);

  // The browser's type is a claim; the first bytes are the fact.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffBannerImageType(bytes);
  if (!type || type !== file.type) return fail("That file isn't a png, jpg or gif image.", 400);

  try {
    return NextResponse.json({ url: await storeBannerImage(discord.guildId, type, bytes) });
  } catch (error) {
    reportError(error, "web-admin discord: banner upload");
    return fail("Couldn't store that image. Try again?", 500);
  }
}
