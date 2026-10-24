import type { Page } from "playwright";

export type Theme = "dark" | "light";

/** Which app serves the route. */
export type App = "dashboard";

export type AuthRole = "none" | "smoke-user";

export type Crop =
  | { kind: "viewport" }
  | { kind: "fullPage" }
  /** The tightest useful default: one element, with a little breathing room. */
  | { kind: "element"; selector: string; padding?: number }
  /** The bounding box of several elements, for a control plus what it acts on. */
  | { kind: "union"; selectors: string[]; padding?: number }
  | { kind: "rect"; x: number; y: number; width: number; height: number };

export type Settle =
  /**
   * `attached` is for marker attributes like [data-shot-ready], which live on
   * <html> and so are never "visible"; `visible` is for real elements.
   */
  | { kind: "selector"; selector: string; state?: "visible" | "attached" }
  | { kind: "selectorGone"; selector: string }
  | { kind: "fonts" }
  /** Let JS-driven motion reach a resting frame before shooting. */
  | { kind: "wait"; ms: number }
  | { kind: "networkIdle" };

/**
 * Substitute a plausible fake value. Never a black box — see docs/branding.md.
 */
export interface Redaction {
  selector: string;
  text?: string;
  attr?: { name: string; value: string };
}

export interface Shot {
  /** Path under apps/docs/images/, without the extension. Also the shot's id. */
  id: string;
  /** One line, used to regenerate apps/docs/images/README.md. */
  description: string;

  route: string;
  app?: App;
  auth?: AuthRole;
  /**
   * "onboarding" starts the run with the wizard unfinished, which is a
   * different state from every other authenticated shot.
   */
  seed?: "default" | "onboarding";

  viewport: { width: number; height: number; dsf?: number };
  theme?: Theme;

  /**
   * Waited for BEFORE actions run. Actions that call into page scripts need
   * [data-shot-ready] here, or they fire into a page that has not hydrated and
   * do nothing at all.
   */
  settle?: Settle[];
  /** Typed, so a renamed selector fails to compile rather than at 2am. */
  actions?: Array<(page: Page) => Promise<void>>;
  /** Waited for AFTER actions, to let what they triggered settle. */
  settleAfter?: Settle[];
  redact?: Redaction[];
  crop: Crop;

  /** Hard cap in KB. Defaults to the branding doc's ~300. */
  maxKb?: number;
  /** Known non-deterministic; excluded from --check. */
  unstable?: boolean;
}

export function defineShots(shots: Shot[]): Shot[] {
  const seen = new Set<string>();
  for (const shot of shots) {
    if (seen.has(shot.id)) throw new Error(`Duplicate shot id: ${shot.id}`);
    seen.add(shot.id);
  }
  return shots;
}

/** `--only 'overlays/*'` and `--only overlays/goal-presets` both work. */
export function matchesFilter(id: string, filter: string | undefined): boolean {
  if (!filter) return true;
  const pattern = new RegExp(`^${filter.split("*").map(escapeRegex).join(".*")}$`);
  return pattern.test(id);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
