// Opens (or reuses) the OBS viewer popup with no handle back to the page that
// opened it. The viewer window frames a node's page, and a frame can reach
// `top.opener` even across origins, so the link is cut before anything loads.
//
// Not window.open's "noopener" feature: with it, Chromium no longer reuses a
// window of the same name, so every click opens another viewer, and a second
// viewer of one instance takes the session from the first.
export function openViewerWindow(url: string, name: string): void {
  const popup = window.open(url, name, "width=1280,height=800");
  if (popup) popup.opener = null;
}
