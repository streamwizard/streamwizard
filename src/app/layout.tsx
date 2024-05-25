import { Analytics } from "@vercel/analytics/react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/providers/theme-provider";
import { Toaster } from "sonner";
import ModalProvider from "@/providers/modal-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "StreamWizard", // Replace with a catchy title
  description:
    "Elevate your Twitch streams by letting viewers request songs directly from your chat. StreamWizard fosters a more interactive and engaging experience for you and your chat.", // Replace with a descriptive summary
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
    <html lang="en">
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark">
          <ModalProvider>{children}</ModalProvider>
          <Toaster position="bottom-right" visibleToasts={10} theme="dark" />
        </ThemeProvider>
      </body>
    </html>
  );
}
