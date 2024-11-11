import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "@/providers/theme-provider";
import { Toaster } from "sonner";
import { ModalProvider } from "@/providers/modal-provider";

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

export const metadata: Metadata = {
  title: "StreamWizard",
  description:
    "Elevate your Twitch streams by letting viewers request songs directly from your chat. StreamWizard fosters a more interactive and engaging experience for you and your chat.",
  authors: {
    name: "StreamWizard",
    url: "https://streamwizard.org",
  },

  keywords: ["twitch", "music", "streaming", "interactive", "chat"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <ModalProvider>
            <Toaster position="bottom-right" theme="system" expand visibleToasts={5} />
            {children}
          </ModalProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
