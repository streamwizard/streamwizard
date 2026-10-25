import type { Page } from "playwright";
import type { Crop, Settle, Shot } from "./manifest";
import { FREEZE_STYLES } from "./prepare";

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function pad(box: Box, by: number): Box {
  return {
    x: Math.max(0, box.x - by),
    y: Math.max(0, box.y - by),
    width: box.width + by * 2,
    height: box.height + by * 2,
  };
}

function union(boxes: Array<Box | null>): Box {
  const found = boxes.filter((b): b is Box => b !== null);
  if (found.length === 0) throw new Error("None of the union selectors matched anything");
  const left = Math.min(...found.map((b) => b.x));
  const top = Math.min(...found.map((b) => b.y));
  const right = Math.max(...found.map((b) => b.x + b.width));
  const bottom = Math.max(...found.map((b) => b.y + b.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * The first hit on a cold route can 500 while Next compiles it, so retry
 * rather than leaving that for a human to notice in a diff.
 */
export async function goto(page: Page, url: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
    if (!res || res.status() < 500) return;
    await page.waitForTimeout(2_000);
  }
  throw new Error(`${url} kept answering 5xx. Is the dev server healthy?`);
}

export async function settle(page: Page, steps: readonly Settle[] = []): Promise<void> {
  for (const step of steps) {
    switch (step.kind) {
      case "selector":
        await page
          .locator(step.selector)
          .first()
          .waitFor({ state: step.state ?? "visible", timeout: 30_000 });
        break;
      case "selectorGone":
        await page.locator(step.selector).first().waitFor({ state: "hidden", timeout: 30_000 });
        break;
      case "fonts":
        await page.evaluate(() => document.fonts.ready);
        break;
      case "wait":
        await page.waitForTimeout(step.ms);
        break;
      case "networkIdle":
        await page.waitForLoadState("networkidle", { timeout: 30_000 });
        break;
    }
  }
  await page.addStyleTag({ content: FREEZE_STYLES });
}

export async function capture(page: Page, shot: Shot): Promise<Buffer> {
  const crop: Crop = shot.crop;
  const common = { type: "png" as const, animations: "disabled" as const };

  switch (crop.kind) {
    case "viewport":
      return page.screenshot(common);
    case "fullPage":
      return page.screenshot({ ...common, fullPage: true });
    case "rect":
      return page.screenshot({ ...common, clip: crop });
    case "element": {
      const el = page.locator(crop.selector).first();
      if (!crop.padding) return el.screenshot(common);
      const box = await el.boundingBox();
      if (!box) throw new Error(`${crop.selector} has no box to crop to`);
      return page.screenshot({ ...common, clip: pad(box, crop.padding) });
    }
    case "union": {
      const boxes = await Promise.all(
        crop.selectors.map((s) => page.locator(s).first().boundingBox()),
      );
      return page.screenshot({ ...common, clip: pad(union(boxes), crop.padding ?? 0) });
    }
  }
}
