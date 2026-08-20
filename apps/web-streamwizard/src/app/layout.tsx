import { CookieBanner } from "@/components/cookie-banner";
import { LightModeOverlay } from "@/components/global/light-mode-overlay";
import { ThemeProvider } from "@/providers/theme-provider";
import { PHProvider, PostHogPageView } from "@repo/posthog";
import { siteUrl } from "@/lib/seo";
import { Metadata } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import { Suspense } from "react";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const SITE_NAME = "StreamWizard";
const SITE_TITLE = "StreamWizard: Cloud OBS, Clips, and Analytics for Twitch";
const SITE_DESCRIPTION =
  "Cloud OBS for IRL streaming, overlays, clip management, and stream analytics for Twitch streamers. Open source and built in public.";

export const metadata: Metadata = {
  // Every relative URL below (and the generated OG image) resolves against this.
  // Without it Next silently emits relative og:image paths, which no scraper follows.
  metadataBase: new URL(siteUrl()),
  title: {
    default: SITE_TITLE,
    template: `%s – ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: {
    name: SITE_NAME,
    url: "https://streamwizard.org",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Per-request nonce set by the proxy (src/proxy.ts). next-themes injects an
  // inline anti-flash script that Next can't nonce for us, so we forward it
  // explicitly or the CSP blocks the script (script-src has no 'unsafe-inline').
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <PHProvider>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange nonce={nonce}>
            <LightModeOverlay />
            <Suspense>
              <PostHogPageView />
            </Suspense>
            <Toaster position="bottom-right" theme="dark" expand visibleToasts={5} />
            <CookieBanner />
            {children}
          </ThemeProvider>
        </PHProvider>
      </body>
    </html>
  );
}
