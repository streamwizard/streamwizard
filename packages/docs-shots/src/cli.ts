import { mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { launch, newContext } from "./browser";
import { signInCookie, localSupabase } from "./auth";
import { seedShotData, type SeedHandle } from "./seed";
import { stubRemoteImages } from "./stub-images";
import { capture, goto, settle } from "./capture";
import { applyRedactions, assertNoLeaks } from "./redact";
import { assertNotBlank, optimize } from "./optimize";
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
  /** Leave the seeded rows in place, for poking at a page by hand. */
  keepSeed: boolean;
  /** Remove the seeded rows and capture nothing. */
  teardown: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    write: false,
    check: false,
    headed: false,
    keepSeed: false,
    teardown: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--only") args.only = argv[++i];
    else if (arg === "--write") args.write = true;
    else if (arg === "--check") args.check = true;
    else if (arg === "--headed") args.headed = true;
    else if (arg === "--keep-seed") args.keepSeed = true;
    else if (arg === "--teardown") args.teardown = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.teardown) {
    await (await seedShotData()).teardown();
    console.log("Seeded rows removed.");
    return;
  }

  const selected = SHOTS.filter((s) => matchesFilter(s.id, args.only));

  if (selected.length === 0) {
    console.error(args.only ? `No shots match ${args.only}` : "No shots defined");
    process.exit(1);
  }

  // Only pay for a Supabase round trip when a shot actually needs a session.
  const needsAuth = selected.some((s) => s.auth && s.auth !== "none");
  const cookie = needsAuth ? await signInCookie(localSupabase()) : undefined;

  // Seeded rows exist only for the length of the run. The onboarding shots
  // need the wizard unfinished, which is a different starting state, so they
  // are seeded separately rather than fighting over one preference.
  const needsOnboarding = selected.some((s) => s.seed === "onboarding");
  let seed: SeedHandle | undefined;
  if (needsAuth) seed = await seedShotData({ onboarding: needsOnboarding });

  const browser = await launch();
  const results: Array<{
    id: string;
    verdict: Verdict | "failed";
    error?: string;
    unstable: boolean;
  }> = [];

  for (const shot of selected) {
    const context = await newContext(browser, shot, cookie);
    const page = await context.newPage();
    try {
      await stubRemoteImages(page);
      // Freeze Date before anything renders, so a clock or an uptime reads the
      // same value on every run. setFixedTime rather than install: install also
      // stubs setTimeout and MessageChannel, which React's scheduler needs to
      // hydrate at all.
      await page.clock.setFixedTime(SHOT_TIME);
      await goto(page, `${BASE_URL}${shot.route}`);

      await settle(page, shot.settle);
      for (const action of shot.actions ?? []) await action(page);
      await settle(page, shot.settleAfter);
      await applyRedactions(page, shot.redact);
      // Before anything is written to disk.
      await assertNoLeaks(page, shot.id);

      const raw = await capture(page, shot);
      // "No error" is not the same as "shows something": an action that fired
      // into an unhydrated page leaves a correctly-cropped picture of nothing.
      await assertNotBlank(raw, shot.id);
      const png = await optimize(raw, shot.id, shot.maxKb);

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
      results.push({ id: shot.id, verdict, unstable: shot.unstable === true });
    } catch (error) {
      results.push({
        id: shot.id,
        verdict: "failed",
        error: String(error),
        unstable: shot.unstable === true,
      });
    } finally {
      await context.close();
    }
  }

  await browser.close();
  if (seed && !args.keepSeed) await seed.teardown();
  report(results, args);
}

function report(
  results: Array<{ id: string; verdict: Verdict | "failed"; error?: string; unstable: boolean }>,
  args: Args,
) {
  const width = Math.max(...results.map((r) => r.id.length));
  for (const r of results) {
    if (r.verdict === "failed") console.log(`${r.id.padEnd(width)}  FAILED   ${r.error}`);
    else {
      const note = r.unstable ? "  (unstable, not gated)" : "";
      console.log(`${r.id.padEnd(width)}  ${describe(r.verdict)}${note}`);
    }
  }

  const failed = results.filter((r) => r.verdict === "failed").length;
  const changed = results.filter(
    (r) => r.verdict !== "failed" && (r.verdict.kind === "changed" || r.verdict.kind === "resized"),
  );
  // A shot of something that genuinely moves, like a bouncing train, drifts by
  // design. It is still captured and still written; it just cannot gate CI.
  const gated = changed.filter((r) => !r.unstable).length;

  console.log(
    `\n${results.length} shots, ${changed.length} changed (${gated} gated), ${failed} failed` +
      (args.write ? ", written to apps/docs/images" : ", nothing written (pass --write)"),
  );

  if (failed > 0) process.exit(1);
  if (args.check && gated > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
