import sharp from "sharp";
import type { Page } from "playwright";

/**
 * Twitch's CDNs, which a screenshot run must never actually hit: the fixture
 * clips do not exist, so every thumbnail would 404 and the clips page would
 * read as broken rather than as empty.
 */
const REMOTE_IMAGES = /static-cdn\.jtvnw\.net|clips-media-assets|ttvnw\.net/;

/**
 * Emotes and badges are the exception: they are small, public, and they ARE
 * the thing the emote wall and chat box pages are showing. A stubbed rectangle
 * in place of an emote reads as a broken image rather than as a feature.
 */
const REAL_IMAGES = /\/emoticons\/|\/badges\/|7tv\.app|betterttv|frankerfacez/;

/** Deterministic colour per URL, so a thumbnail never changes between runs. */
function hueFor(url: string): number {
  let h = 0;
  for (let i = 0; i < url.length; i++) h = (h * 31 + url.charCodeAt(i)) >>> 0;
  return h % 360;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

/**
 * Twitch's video and clip players. Both load an iframe that needs network and
 * a recording that still exists; the fixture clips and VODs do not, so they
 * render "This clip is no longer available" across the shot. Replaced with a
 * flat panel, which also stops the screenshot rotting when Twitch deletes a
 * real recording.
 */
export async function stubTwitchPlayer(page: Page): Promise<void> {
  await page.route(/player\.twitch\.tv|clips\.twitch\.tv|embed\/v1\.js/, async (route) => {
    const isScript = route.request().url().endsWith(".js");
    await route.fulfill({
      status: 200,
      contentType: isScript ? "application/javascript" : "text/html",
      body: isScript
        ? "window.Twitch = { Player: function () { this.addEventListener = function () {}; } };"
        : "<!doctype html><html><body style=\"margin:0;background:#0b0b12\"></body></html>",
    });
  });
}

/**
 * Serve a flat, dark, slightly-coloured rectangle in place of every Twitch
 * image. It reads as a thumbnail at a glance without pretending to be footage
 * StreamWizard does not have the rights to publish.
 */
export async function stubRemoteImages(page: Page): Promise<void> {
  await page.route(REMOTE_IMAGES, async (route) => {
    if (REAL_IMAGES.test(route.request().url())) return route.continue();
    const hue = hueFor(route.request().url());
    const [r, g, b] = hslToRgb(hue, 0.3, 0.22);
    const png = await sharp({
      create: { width: 480, height: 272, channels: 3, background: { r, g, b } },
    })
      .png()
      .toBuffer();
    await route.fulfill({ status: 200, contentType: "image/png", body: png });
  });
}
