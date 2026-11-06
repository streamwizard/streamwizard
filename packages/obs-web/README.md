# @repo/obs-web

Browser-side Cloud OBS pieces shared by web-streamwizard and web-admin: the OBS desktop viewer, ws-ticket minting, the obs-websocket hook and the auto switcher forms.

Everything is exported from the package root (`@repo/obs-web`). The package reads no env variables: apps pass the node's `apiUrl` (from a trusted server-side lookup, never the query string) and a function that returns a node token.

## OBS desktop viewer (`src/viewer/`)

`CloudOBSViewer` shows an instance's Selkies viewer in a cross-origin `<iframe>` on the node's own origin and draws our header and controls around it. The Selkies client never runs on an app's origin.

1. Probes `HEAD <viewerRoot>` until the node answers 200 (`readiness.ts`; no ticket is spent while OBS starts).
2. Mints a ticket (`getViewerUrl`, built on `mintSelkiesViewerUrl`) and frames `<viewerRoot>#token=<ticket>`.
3. Pairs with the relay that obs-instance-manager serves in the page (`relay-protocol.ts`, Zod-parsed, node origin and frame window checked). Mute, volume and clipboard text go through it.
4. When the relay reports `viewer-expired`, mints a new ticket and mounts a new frame, spaced and capped by `reconnect-guard.ts`.

Against a node without the relay, the viewer shows the frame with Full screen and Reconnect only. The protocol is documented in obs-instance-manager's `docs/PANEL_INTEGRATION.md`.

Other viewer exports: `selkiesViewerRoot()` (the page URL without a ticket), `CloudOBSViewerPlaceholder` (the window before the node is known) and `openViewerWindow()` (opens or reuses the popup without a handle back to the opener).

## Other entry points

- `ws-ticket.ts`: `mintWsUrl()` and `mintSelkiesViewerUrl()`, single-use tickets from the node, minted with a node token.
- `use-obs-websocket.ts`: obs-websocket connection hook.
- `auto-switcher-form.tsx`, `auto-switcher-override-controls.tsx`: the auto switcher UI.

## Tests

`bun test` in this folder.
