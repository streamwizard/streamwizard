import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { OverlayWsUrlProvider } from "@repo/ui/components/overlay/hooks/use-overlay-ws-url";
import { env } from "@/lib/env";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://overlay.streamwizard.org"),
  title: {
    default: "StreamWizard Overlay",
    template: "%s · StreamWizard Overlay",
  },
  description:
    "Renders StreamWizard broadcast overlays. Open overlay URLs from your dashboard at streamwizard.org.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <OverlayWsUrlProvider url={env.NEXT_PUBLIC_WS_SERVER_URL}>{children}</OverlayWsUrlProvider>
      </body>
    </html>
  );
}
