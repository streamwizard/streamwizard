---
paths:
  - "apps/*/src/**"
  - "packages/*/src/**"
---

# Types

Part of the StreamWizard rulebook; Claude Code loads it automatically when working on matching files. The golden rules are in [ARCHITECTURE.md](../../../ARCHITECTURE.md).

One question decides where a type lives: **does another file need it?**

| The type is used by | It lives in |
|---------------------|------------|
| only this file | the top of this file, after the imports, not exported |
| callers of one module's exported functions (its params, results, row aliases) | that module, exported next to the function |
| several modules of the same app or package, with no single owner | `src/types/<domain>.ts` of that app or package, exported |
| more than one app or package | `@repo/types` (or the package that owns the data), exported |

## Rules

- **Types that belong to one module's API are exported from that module**: the params and result of an exported function, and the row alias a query module returns (`export type ObsNode = Tables<"obs_nodes">` in `queries/obs-nodes/nodes.ts`). Callers import them from the same entry point as the function.
- **Types shared by several modules with no single owner live in `src/types/<domain>.ts`** (one file per domain, `src/types/overlays.ts`, `src/types/widget-library.ts`). Never export a type from a component, route, page or server-action file; move it to `src/types/` (apps) or to the module that owns it (packages). No `types.ts` dumping ground at the `src/` root.
- **Local types go at the top of the file** that uses them, right after the imports, and are not exported. If a second file starts needing one, move it in the same change.
- **Types inferred from a Zod schema stay with the schema** (`export type Config = z.infer<typeof configSchema>` in the schema file). Moving them would create a second copy to keep in sync.
- **Component props stay in the component file** as a local `type <Name>Props`. A file that needs another component's props uses `ComponentProps<typeof Component>` instead of importing the type.
- **Database rows come from the generated types** (`Database["public"]["Tables"]["clips"]["Row"]`, `Tables<"clips">`). Never hand-write a row shape; if a short name helps, alias it. Browser and client-library packages (`@repo/ui`) may take rows with `import type { Database } from "@repo/supabase/types/supabase"`: it's type-only, so no server code reaches the bundle. List `@repo/supabase` as a devDependency; don't hand-copy a row to avoid the dependency.
- **A new table goes into the generated types in the same PR as its migration:** run `bun run gen-types` against the local DB, or hand-edit the table into `packages/supabase/src/types/supabase.ts` with a comment saying why (see [repo-hygiene.md](repo-hygiene.md)). Never cast a table name or payload `as never` / `as unknown as` to get past a missing table.
- **Don't redeclare.** Before writing a type, search `src/types/`, `@repo/types`, `@repo/schemas` and the generated DB types. Derive with `Pick`, `Omit`, `Partial` or `z.infer` instead of copying fields (see [duplicate-code.md](duplicate-code.md)).
- **Type files hold types only.** `src/types/*.ts` and `@repo/types` contain types, interfaces and type-only re-exports; a type guard for one of those types is the one allowed function. Helpers, constants and lookup tables go in `src/lib/` or the package that owns the behavior (`as const` arrays that a union is derived from stay with their schema).
- **Type names are PascalCase nouns** (`ClipWithFolders`, `IngestNode`); no `I` prefix, no `Type` suffix. Row aliases use the singular table name (`ObsNode` for `obs_nodes`).
- **Packages expose their types through `exports`**, like any other entry point, never through a barrel (see [packages.md](packages.md)). A package with one domain may keep a single `src/types.ts`, exported as `"./types"`. A package with several domains uses `src/types/<domain>.ts`, exported as `"./types/*": "./src/types/*.ts"`. `@repo/types` has no `.` entry: import the file by subpath (`@repo/types/eventsub`, `@repo/types/helix`, `@repo/types/overlay-ws`, `@repo/types/monitor`, ...), and a new domain is a new file there. The generated DB types are imported as `@repo/supabase/types/supabase`.
- **Import types with `import type`** (or an inline `type` specifier) so they never pull runtime code into a bundle. Turning on `verbatimModuleSyntax: true` in `@repo/typescript-config` and each app's tsconfig would make `bunx tsc --noEmit` enforce this; it isn't on yet.

**Current state:** most exported types still sit in component, action and module files, and four Bun apps (rest-api, streamwizard-bot, alert-worker, obs-auto-switcher) have no `src/types/` yet. Move a type when you touch its file and a second file uses it.
