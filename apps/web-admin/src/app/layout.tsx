import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "StreamWizard Admin",
  description: "Internal admin control panel",
  // Internal tool: keep every route out of search results.
  robots: { index: false, follow: false },
};

// viewport-fit=cover exposes the safe-area insets the phone bottom bar pads for.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Per-request nonce from src/proxy.ts, so the CSP allows the theme script.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem nonce={nonce}>
          {children}
          {/* mobileOffset lifts toasts above the phone bottom bar. */}
          <Toaster position="bottom-right" theme="dark" expand visibleToasts={5} mobileOffset={{ bottom: "5rem" }} />
        </ThemeProvider>
      </body>
    </html>
  );
}
