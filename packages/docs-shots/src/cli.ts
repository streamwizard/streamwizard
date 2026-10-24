import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { launch, newContext } from "./browser";
import { signInCookie, localSupabase } from "./auth";
import { capture, goto, settle } from "./capture";
import { applyRedactions, assertNoLeaks } from "./redact";
import { optimize } from "./optimize";
import { compare, describe, type Verdict } from "./drift";
import { matchesFilter } from "./manifest";
import { SHOTS } from "./shots";

const REPO_ROOT = resolve(import.meta.dirname, "../../..");
const IMAGES_DIR = join(REPO_ROOT, "apps/docs/images");
const OUT_DIR = resolve(import.meta.dirname, "../.out");
const BASE_URL = process.env.SHOTS_BASE_URL ?? "http://localhost:3000";

/** The moment every screenshot is taken at. Keeps dates out of the drift report. */
const SHOT_TIME = new Date("2026-08-14T21:10:00Z");

interface Args {
  only?: string;
  write: boolean;
  check: boolean;
  headed: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { write: false, check: false, headed: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--only") args.only = argv[++i];
    else if (arg === "--write") args.write = true;
    else if (arg === "--check") args.check = true;
    else if (arg === "--headed") args.headed = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const selected = SHOTS.filter((s) => matchesFilter(s.id, args.only));

  if (selected.length === 0) {
    console.error(args.only ? `No shots match ${args.only}` : "No shots defined");
    process.exit(1);
  }

  // Only pay for a Supabase round trip when a shot actually needs a session.
  const needsAuth = selected.some((s) => s.auth && s.auth !== "none");
  const cookie = needsAuth ? await signInCookie(localSupabase()) : undefined;

  const browser = await launch();
  const results: Array<{ id: string; verdict: Verdict | "failed"; error?: string }> = [];

  for (const shot of selected) {
    const context = await newContext(browser, shot, cookie);
    const page = await context.newPage();
    try {
      // Freeze Date before anything renders, so a clock or an uptime reads the
      // same value on every run. setFixedTime rather than install: install also
      // stubs setTimeout and MessageChannel, which React's scheduler needs to
      // hydrate at all.
      await page.clock.setFixedTime(SHOT_TIME);
      await goto(page, `${BASE_URL}${shot.route}`);

      for (const action of shot.actions ?? []) await action(page);
      await settle(page, shot.settle);
      await applyRedactions(page, shot.redact);
      // Before anything is written to disk.
      await assertNoLeaks(page, shot.id);

      const png = await optimize(await capture(page, shot), shot.id, shot.maxKb);

      const outPath = join(OUT_DIR, `${shot.id}.png`);
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, png);

      const diffPath = join(OUT_DIR, "_diff", `${shot.id.replace(/\//g, "-")}.png`);
      mkdirSync(dirname(diffPath), { recursive: true });
      const verdict = compare(join(IMAGES_DIR, `${shot.id}.png`), png, diffPath);

      if (args.write && verdict.kind !== "same") {
        const dest = join(IMAGES_DIR, `${shot.id}.png`);
        mkdirSync(dirname(dest), { recursive: true });
        copyFileSync(outPath, dest);
      }
      results.push({ id: shot.id, verdict });
    } catch (error) {
      results.push({ id: shot.id, verdict: "failed", error: String(error) });
    } finally {
      await context.close();
    }
  }

  await browser.close();
  report(results, args);
}

function report(
  results: Array<{ id: string; verdict: Verdict | "failed"; error?: string }>,
  args: Args,
) {
  const width = Math.max(...results.map((r) => r.id.length));
  for (const r of results) {
    if (r.verdict === "failed") console.log(`${r.id.padEnd(width)}  FAILED   ${r.error}`);
    else console.log(`${r.id.padEnd(width)}  ${describe(r.verdict)}`);
  }

  const failed = results.filter((r) => r.verdict === "failed").length;
  const drifted = results.filter(
    (r) => r.verdict !== "failed" && (r.verdict.kind === "changed" || r.verdict.kind === "resized"),
  ).length;

  console.log(
    `\n${results.length} shots, ${drifted} changed, ${failed} failed` +
      (args.write ? ", written to apps/docs/images" : ", nothing written (pass --write)"),
  );

  if (failed > 0) process.exit(1);
  if (args.check && drifted > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
