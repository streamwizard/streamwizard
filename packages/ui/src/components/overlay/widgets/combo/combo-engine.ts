import type { ComboWidgetItemConfig } from "./combo-widget-config";

/**
 * Emote combo tracking. Pure: every function takes a state and returns the
 * next one, and returns the same object when nothing changed so React can
 * skip the render.
 *
 * Any emote can be a candidate; only candidates past the threshold get a slot
 * on screen. Slots keep their position, so a combo doesn't jump around while
 * it counts up.
 */

export interface Combo {
  /** Unique per combo, so a new Kappa combo after an old one ends is its own row. */
  id: number;
  code: string;
  url: string;
  count: number;
  /** Logins that joined. Only filled in `unique` count mode. */
  users: string[];
  startedAt: number;
  lastAt: number;
  /** Set when the combo stops counting. It lingers on screen after this. */
  endedAt: number | null;
}

export interface ComboState {
  combos: Combo[];
  /** Combo ids on screen, by slot. */
  shown: number[];
  nextId: number;
}

export type ComboRules = Pick<
  ComboWidgetItemConfig,
  "mode" | "windowSeconds" | "threshold" | "countMode" | "maxCombos" | "lingerSeconds"
>;

export interface ComboMessage {
  login: string;
  emotes: readonly { code: string; url: string }[];
  at: number;
}

/** Candidates tracked at once. A busy chat with many emotes drops the stalest first. */
const MAX_CANDIDATES = 50;
/** Per combo. Past this the count still goes up, the list just stops growing. */
const MAX_USERS = 5000;

export const EMPTY_COMBO_STATE: ComboState = { combos: [], shown: [], nextId: 1 };

/** Counts one chat message towards every emote in it. */
export function applyComboMessage(state: ComboState, msg: ComboMessage, rules: ComboRules): ComboState {
  const windowMs = rules.windowSeconds * 1000;
  const login = msg.login.toLowerCase();

  // One message counts once per emote, however many times it's typed.
  const codes = new Map<string, string>();
  for (const e of msg.emotes) if (!codes.has(e.code)) codes.set(e.code, e.url);

  let changed = false;
  let nextId = state.nextId;
  let combos = state.combos.map((c) => {
    if (c.endedAt !== null) return c;
    const stale = msg.at - c.lastAt > windowMs;
    // Back to back: a message without this emote breaks it.
    const broken = rules.mode === "back_to_back" && !codes.has(c.code);
    if (!stale && !broken) return c;
    changed = true;
    return { ...c, endedAt: stale ? c.lastAt + windowMs : msg.at };
  });

  for (const [code, url] of codes) {
    const i = combos.findIndex((c) => c.code === code && c.endedAt === null);
    if (i === -1) {
      combos = [
        ...combos,
        {
          id: nextId++,
          code,
          url,
          count: 1,
          users: rules.countMode === "unique" && login ? [login] : [],
          startedAt: msg.at,
          lastAt: msg.at,
          endedAt: null,
        },
      ];
      changed = true;
      continue;
    }
    const combo = combos[i]!;
    // Unique mode: someone already in doesn't count again, and doesn't keep
    // the combo alive on their own either.
    if (rules.countMode === "unique" && login && combo.users.includes(login)) continue;
    const users =
      rules.countMode === "unique" && login && combo.users.length < MAX_USERS
        ? [...combo.users, login]
        : combo.users;
    combos = combos.slice();
    combos[i] = { ...combo, count: combo.count + 1, users, lastAt: msg.at };
    changed = true;
  }

  if (!changed) return state;
  return withSlots({ combos: dropNeverShown(capCandidates(combos, state.shown), state.shown), shown: state.shown, nextId }, rules);
}

/**
 * Ends combos that went quiet and removes the ones done lingering. Call it on
 * a timer while any combo exists.
 */
export function tickCombos(state: ComboState, now: number, rules: ComboRules): ComboState {
  if (state.combos.length === 0) return state;
  const windowMs = rules.windowSeconds * 1000;
  const lingerMs = rules.lingerSeconds * 1000;
  let changed = false;
  const combos: Combo[] = [];
  for (const c of state.combos) {
    let next = c;
    if (next.endedAt === null && now - next.lastAt > windowMs) {
      next = { ...next, endedAt: next.lastAt + windowMs };
      changed = true;
    }
    if (next.endedAt !== null) {
      // Never made it on screen: nothing to linger for.
      const onScreen = state.shown.includes(next.id);
      if (!onScreen || now - next.endedAt >= lingerMs) {
        changed = true;
        continue;
      }
    }
    combos.push(next);
  }
  if (!changed) return state;
  return withSlots({ ...state, combos }, rules);
}

/** The combos on screen, by slot. */
export function visibleCombos(state: ComboState): Combo[] {
  const out: Combo[] = [];
  for (const id of state.shown) {
    const c = state.combos.find((x) => x.id === id);
    if (c) out.push(c);
  }
  return out;
}

/** Drops ended candidates that never reached the screen. */
function dropNeverShown(combos: Combo[], shown: readonly number[]): Combo[] {
  return combos.some((c) => c.endedAt !== null && !shown.includes(c.id))
    ? combos.filter((c) => c.endedAt === null || shown.includes(c.id))
    : combos;
}

function capCandidates(combos: Combo[], shown: readonly number[]): Combo[] {
  if (combos.length <= MAX_CANDIDATES) return combos;
  const spare = combos
    .filter((c) => !shown.includes(c.id))
    .sort((a, b) => a.lastAt - b.lastAt)
    .slice(0, combos.length - MAX_CANDIDATES)
    .map((c) => c.id);
  return combos.filter((c) => !spare.includes(c.id));
}

/**
 * Fills and swaps slots. Free slots take the biggest combos past the
 * threshold. A lingering combo gives its slot to any new one; a live combo
 * only to one with a higher count. Swaps happen in place, so the others
 * don't move.
 */
function withSlots(state: ComboState, rules: ComboRules): ComboState {
  const byId = new Map(state.combos.map((c) => [c.id, c]));
  const shown = state.shown.filter((id) => byId.has(id)).slice(0, rules.maxCombos);
  const eligible = state.combos
    .filter((c) => c.endedAt === null && c.count >= rules.threshold && !shown.includes(c.id))
    .sort((a, b) => b.count - a.count);

  for (const candidate of eligible) {
    if (shown.length < rules.maxCombos) {
      shown.push(candidate.id);
      continue;
    }
    // The weakest slot: lingering first, then the lowest live count.
    let weakest = -1;
    for (let i = 0; i < shown.length; i++) {
      const c = byId.get(shown[i]!)!;
      const w = weakest === -1 ? null : byId.get(shown[weakest]!)!;
      const rank = (x: Combo) => (x.endedAt !== null ? -1 : x.count);
      if (w === null || rank(c) < rank(w)) weakest = i;
    }
    const current = byId.get(shown[weakest]!)!;
    if (current.endedAt !== null || candidate.count > current.count) {
      shown[weakest] = candidate.id;
    }
  }

  const same = shown.length === state.shown.length && shown.every((id, i) => id === state.shown[i]);
  // Swapped-out lingering combos have nowhere to linger; drop them.
  const combos = same ? state.combos : dropNeverShown(state.combos, shown);
  return { combos, shown: same ? state.shown : shown, nextId: state.nextId };
}
