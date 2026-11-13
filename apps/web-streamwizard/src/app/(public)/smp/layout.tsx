import localFont from "next/font/local";
import type { ReactNode } from "react";

/*
 * /smp is the one public page with its own look: the modpack's title screen
 * (see "SMP page" in docs/branding.md). This layout carries what that needs.
 *
 * - Pixelify Sans (SIL Open Font License, licence next to the file) for
 *   headings and buttons. Declared here, so only this route loads it. Body
 *   text, the form and the FAQ stay in Geist.
 * - `dark scheme-dark`: the page is a night scene, so it uses the dark tokens
 *   and dark form controls whatever theme the visitor has picked. The site
 *   header and footer around it keep following their theme.
 */
const pixelify = localFont({
  src: "../../fonts/PixelifySans-latin-VF.woff2",
  variable: "--font-pixelify",
  weight: "400 700",
  display: "swap",
});

export default function SmpLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className={`${pixelify.variable} dark scheme-dark smp-theme min-h-screen overflow-x-hidden text-foreground`}>
      {children}
    </div>
  );
}
