import type { Metadata, Viewport } from "next";
import { requireProductAccess } from "@/lib/require-product-access";
import { getAutoSwitcherConfig } from "@/actions/supabase/auto-switcher";
import { DeckContent } from "./_deck-content";

export const metadata: Metadata = {
  title: "Stream Deck",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Stream Deck",
  },
};

// Lock the viewport so rapid scene tapping never triggers double-tap zoom, and
// viewportFit covers the notch/safe-area on phones this page is built for.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export default async function DeckPage() {
  const [access, autoSwitcherConfig] = await Promise.all([requireProductAccess("cloud_obs"), getAutoSwitcherConfig()]);

  return (
    <>
      {/* Only this route links the manifest, so Chrome offers "install" for the
          deck alone. start_url/scope live in the manifest; scope stays "/" so the
          login redirect keeps the user inside the installed app window.
          Rendered as a raw link (React hoists it to <head>) instead of via
          metadata.manifest because the fetch must carry cookies: without
          use-credentials, Cloudflare Access on staging redirects the
          cookieless manifest request to its login page, which CSP blocks. */}
      <link rel="manifest" href="/deck-manifest.webmanifest" crossOrigin="use-credentials" />
      <DeckContent
        canInteract={access.canInteract}
        autoSwitcherConfig={autoSwitcherConfig}
        initialOverride={
          autoSwitcherConfig?.override_scene_uuid ? { sceneName: autoSwitcherConfig.override_scene_name } : null
        }
      />
    </>
  );
}
