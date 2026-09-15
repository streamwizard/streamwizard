import type { Metadata } from "next";
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Per-request nonce from src/proxy.ts, so the CSP allows the theme script.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem nonce={nonce}>
          {children}
          <Toaster position="bottom-right" theme="dark" expand visibleToasts={5} />
        </ThemeProvider>
      </body>
    </html>
  );
}
