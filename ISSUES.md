# Issues spotted during the cleanup pass

Nothing here was changed — the cleanup was behaviour-preserving on purpose.
These are things worth a decision later, roughly most-important first.

## Security

### PostgREST filter built by string interpolation (widget library search)

`packages/supabase/src/queries/overlay-widgets.ts` → `selectApprovedLibraryEntries`
(moved verbatim out of `apps/web-streamwizard/src/actions/widgets.ts`):

```ts
query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
```

`search` comes straight from the widget-library modal's search box. A comma,
parenthesis or dot in the input is parsed as PostgREST filter syntax, not as
text, so a crafted search re-writes the filter — including the
`is_approved=true` scoping the rest of the query relies on. Rows are limited to
approved library entries by that one filter, so this is worth closing.

Fix: escape the value (PostgREST wants `"` around values containing reserved
characters and doubled inner quotes), or use `.textSearch()` / two separate
`ilike` filters with parameter binding.

### Rotating a leaked overlay subscriber token is unreachable

`resetSceneSubscriberToken` (now `apps/web-streamwizard/src/actions/overlays/scenes.ts`)
has **no callers anywhere** — no button, no route. The subscriber token is the
credential that authorizes read-only overlay subscribers, so today a streamer
who leaks their overlay URL has no way to invalidate it. Either wire it into
the overlay settings UI or drop it and design the rotation flow properly.

## Dead code

- `saveOverlayItem` and `deleteOverlayItem` (`actions/overlays/items.ts`) have no
  callers; the editor saves through `saveAllOverlayItems`. They're still exported
  server actions, i.e. a live HTTP surface nothing uses.
- `apps/web-streamwizard/src/components/ui/map.tsx` — 1844 lines, no importers,
  and the only reason `maplibre-gl` is a dependency. Left in place at your call.

## Lint debt (pre-existing)

`bun run lint` in `apps/web-streamwizard` reports 101 errors / 62 warnings, none
of them from files this cleanup touched. The bulk is
`react-hooks/set-state-in-effect` and exhaustive-deps. Two that look like real
bugs rather than style:

- `src/providers/clips-provider.tsx:95` — `setFolders(ClipFolders)` inside an
  effect keyed on `ClipFolders`, i.e. a render-triggering copy of a prop.
- `src/components/vods/timeline/video-timeline.tsx` — 8 findings in one file,
  mostly effects writing state that other effects read.

## Consistency

- The repo has no `.prettierrc`, but `package.json` exposes
  `format: prettier --write "**/*.{ts,tsx,md}"`. Prettier's default 80-column
  width doesn't match how the codebase is actually written (~110–120), so
  running that script would reformat nearly every file. Either add a config
  matching current style or drop the script.
- `apps/web-overlay` has no `check-types` script (the other two web apps do);
  its types are only checked via `bunx tsc --noEmit` by hand.
