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
| other files in the same app or package | `src/types/<domain>.ts` of that app or package, exported |
| more than one app or package | `@repo/types` (or the package that owns the data), exported |

## Rules

- **Exported types live in `src/types/`**, one file per domain (`src/types/overlays.ts`, `src/types/ingest.ts`). Never export a type from a component, route, action or module file, and don't make a `types.ts` dumping ground at the `src/` root.
- **Local types go at the top of the file** that uses them, right after the imports, and are not exported. If a second file starts needing one, move it to `src/types/` in the same change.
- **Types inferred from a Zod schema stay with the schema** (`export type Config = z.infer<typeof configSchema>` in the schema file). Moving them would create a second copy to keep in sync.
- **Component props stay in the component file** as a local `type <Name>Props`. A file that needs another component's props uses `ComponentProps<typeof Component>` instead of importing the type.
- **Database rows come from the generated types** (`Database["public"]["Tables"]["clips"]["Row"]`, `Tables<"clips">`). Never hand-write a row shape; if a short name helps, alias it in `src/types/`.
- **Don't redeclare.** Before writing a type, search `src/types/`, `@repo/types`, `@repo/schemas` and the generated DB types. Derive with `Pick`, `Omit`, `Partial` or `z.infer` instead of copying fields (see [duplicate-code.md](duplicate-code.md)).
- **Packages expose their types through `exports`** like any other entry point (`"./types/*": "./src/types/*.ts"`), not through a barrel (see [packages.md](packages.md)).
- **Import types with `import type`** so they never pull runtime code into a bundle.

**Current state:** types are spread across component, module and `types.ts` files in most apps (for example `apps/ws-server/src/types.ts` and `src/modules/monitor/types.ts`), and `apps/web-streamwizard/src/types/twitch.ts` duplicates part of `@repo/types`. Move exported types into `src/types/` when you touch the file.
