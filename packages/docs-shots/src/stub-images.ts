import sharp from "sharp";
import type { Page } from "playwright";

/**
 * Twitch's CDNs, which a screenshot run must never actually hit: the fixture
 * clips do not exist, so every thumbnail would 404 and the clips page would
 * read as broken rather than as empty.
 */
const REMOTE_IMAGES = /static-cdn\.jtvnw\.net|clips-media-assets|ttvnw\.net/;

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
 * Twitch's video player. It loads player.twitch.tv in an iframe, which needs
 * network and a VOD that has not expired, and reports its own errors over the
 * top of the page. A screenshot of it would rot the day Twitch deletes the
 * recording, so it is replaced with a flat panel.
 */
export async function stubTwitchPlayer(page: Page): Promise<void> {
  await page.route(/player\.twitch\.tv|embed\/v1\.js/, async (route) => {
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
