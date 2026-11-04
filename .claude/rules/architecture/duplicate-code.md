---
paths:
  - "apps/*/src/**"
  - "packages/*/src/**"
  - ".jscpd.json"
---

# Duplicate code

Part of the StreamWizard rulebook; Claude Code loads it automatically when working on matching files. The golden rules are in [ARCHITECTURE.md](../../../ARCHITECTURE.md); this page has the detail.

**Before writing a helper, component, type or schema, look for one that exists:** the shared packages table in [packages.md](packages.md), `packages/*`, the app's `lib/`, `hooks/` and `components/shared/`. Grep for the function or type name and for a distinctive line of logic.

When you find, or are about to write, a second copy, move it to the lowest place both users can reach:

| Both copies are in | Move it to |
|--------------------|-----------|
| one file or one feature folder | a helper or component inside that feature |
| two features of one web app | `components/shared/`, `src/lib/` or `src/hooks/` |
| two modules of one Bun service | `src/lib/` (generic) or `src/middleware/` (HTTP guards); see [backend-services.md](backend-services.md) |
| two folders of one package | a `src/lib/` or `src/hooks/` file in that package (for example `packages/ui/src/components/overlay/lib/`) |
| two apps, or an app and a package | a `packages/*` module (an existing one if it fits, a new one if not) |

- **Types and schemas have one home.** DB rows come from the generated `Database` types, wire contracts from `@repo/types`, Zod schemas from `@repo/schemas` or the package that owns the data. Never redeclare a shape that already exists elsewhere; import it, or derive it with `Pick`/`Omit`/`z.infer`.
- **Similar components get one configurable version**, not one copy per variant (props, slots or a small config object).
- **Duplication on purpose is allowed** only when two domains must stay independent and there's no shared home either can import without breaking a boundary (for example the `slugifyHostname` in the OBS and ingest claim modules). Leave a one-line comment in both copies saying why, so the next person doesn't merge them. If a neutral package like `@repo/types` can hold it, it isn't on purpose: move it.
- **Per-app files are not duplication:** each app's `env.ts` schema ([env.md](env.md)), and Next.js framework files (`instrumentation.ts`, `global-error.tsx`, `not-found.tsx`, `sentry.*.config.ts`). Keep them short, and move any logic in them into a package.
- **Don't extract before the second copy exists.** One use is not a pattern.

**Checker:** `bun run check:dupes` runs [jscpd](https://github.com/kucherenko/jscpd) over `apps/` and `packages/` (TypeScript/TSX, tests and generated types excluded; config in `.jscpd.json`). It fails when duplicated lines go over `threshold` (1.2%; 1.11% on 2026-11-04). When you remove duplication, lower the threshold in the same PR. Never raise it: fix the copy instead.

**Current state:** the overlay widgets still carry most of the duplication: poll and prediction settings share most of their panel body, and the normalizer helpers repeat in the `*-widget-config.ts` files. Shared versions exist for the rest: `useTwitchWidgetFeed`, `ColorField` and `OptionSelect` (web-streamwizard), `useLiveWidgetState` and `EditorHint` (`@repo/ui` overlay), and `createCenteredRootItem` for widget definitions. New widgets use them.
