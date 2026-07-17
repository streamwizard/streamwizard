import type { Metadata, Viewport } from "next";
import { requireProductAccess } from "@/lib/require-product-access";
import { DeckContent } from "./_deck-content";

export const metadata: Metadata = {
  title: "Stream Deck",
  // Only this route links the manifest, so Chrome offers "install" for the
  // deck alone. start_url/scope live in the manifest; scope stays "/" so the
  // login redirect keeps the user inside the installed app window.
  manifest: "/deck-manifest.webmanifest",
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
  const access = await requireProductAccess("cloud_obs");

  return <DeckContent canInteract={access.canInteract} />;
}
