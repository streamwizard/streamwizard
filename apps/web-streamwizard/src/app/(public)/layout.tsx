import { Footer } from "@/components/public/layout/footer";
import Header from "@/components/public/layout/header";
import { ScrollToTop } from "@/components/buttons/scroll-to-top";
import { JsonLd } from "@/components/seo/json-ld";
import { organizationSchema } from "@/lib/seo";

// No metadata export here on purpose. This layout used to duplicate the root's
// title/description with different wording, so the two disagreed about what the
// product is. Public pages now inherit the root metadata and override per page.

/*
 * Impeccable direction contract for the public marketing surface. Emitted below
 * as a real HTML comment (JSX comments don't reach the DOM) so the production
 * build stays auditable against it. Scoped to (public): the root layout is
 * shared with the dashboard, which this contract does not govern.
 */
const DIRECTION_CONTRACT = `<!--
THESIS: The homepage is the stream's own signal path (phone > ingest > cloud OBS > Twitch) drawn as one live line; it refuses the category's hero-screenshot-plus-feature-grid arrangement.
OWN-WORLD: near-black ground, Geist sans and mono; the brand purple-blue-green gradient exists only as the signal line, never as text; mono tabular numerals for ticking stats; red spent exactly once per page (LIVE).
STORY: a streamer sees their own rig drawn live, understands the toolkit is open source and free at the core, and connects Twitch or stars the repo.
FIRST VIEWPORT: open-source manifesto with Twitch and GitHub actions beside the live pipeline running left to right, edge stats ticking on one shared clock, the line terminating in a red LIVE at the Twitch end.
FORM: Signal Path, rank 6 of 7 grounded structures, seed 2e66f9b4.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
-->`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <div hidden aria-hidden="true" dangerouslySetInnerHTML={{ __html: DIRECTION_CONTRACT }} />
      <JsonLd schema={organizationSchema()} />
      <Header />
      <main>{children}</main>
      <Footer />
      <ScrollToTop />
    </>
  );
}
