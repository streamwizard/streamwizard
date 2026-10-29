import { chromium, type Browser, type BrowserContext } from "playwright";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DECLINE_COOKIES, FAKE_WEBSOCKET, SEEDED_RANDOM, pinTheme } from "./prepare";
import type { Shot } from "./manifest";

/**
 * Playwright refuses to launch when its pinned browser revision is missing.
 * `bunx playwright install chromium` fetches the right one, but a machine that
 * already has other revisions cached can run without it, so fall back to the
 * newest installed build rather than failing. PW_CHROMIUM overrides both.
 */
function resolveExecutable(): string | undefined {
  if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM;
  const cache = join(homedir(), ".cache", "ms-playwright");
  if (!existsSync(cache)) return undefined;

  const builds = readdirSync(cache)
    .filter((d) => d.startsWith("chromium-"))
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));

  for (const build of builds) {
    for (const bin of [
      join(cache, build, "chrome-linux", "chrome"),
      join(cache, build, "chrome-linux64", "chrome"),
    ]) {
      if (existsSync(bin)) return bin;
    }
  }
  return undefined;
}

export async function launch(): Promise<Browser> {
  return chromium.launch({
    executablePath: resolveExecutable(),
    // Subpixel antialiasing is the single biggest source of meaningless pixel
    // diffs between machines, which makes the drift report useless.
    args: ["--font-render-hinting=none", "--disable-lcd-text"],
  });
}

export async function newContext(
  browser: Browser,
  shot: Shot,
  cookieHeader?: string,
): Promise<BrowserContext> {
  const theme = shot.theme ?? "dark";
  const context = await browser.newContext({
    viewport: { width: shot.viewport.width, height: shot.viewport.height },
    deviceScaleFactor: shot.viewport.dsf ?? 2,
    colorScheme: theme,
    reducedMotion: "reduce",
    ignoreHTTPSErrors: true,
    locale: "en-US",
    timezoneId: "Europe/Amsterdam",
  });

  await context.addInitScript(
    `${pinTheme(theme)}\n${DECLINE_COOKIES}\n${SEEDED_RANDOM}\n${FAKE_WEBSOCKET}`,
  );

  if (cookieHeader) {
    await context.addCookies(parseCookieHeader(cookieHeader, "localhost"));
  }
  return context;
}

function parseCookieHeader(header: string, domain: string) {
  return header.split("; ").flatMap((pair) => {
    const eq = pair.indexOf("=");
    if (eq < 1) return [];
    return [
      {
        name: pair.slice(0, eq),
        value: pair.slice(eq + 1),
        domain,
        path: "/",
      },
    ];
  });
}
