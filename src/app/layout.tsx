import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "@/providers/theme-provider";
import { Toaster } from "sonner";
import { ModalProvider } from "@/providers/modal-provider";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (env.NODE_ENV === "development") {
    const clientIP = (await headers()).get("x-forwarded-for") || null;

    console.log(clientIP);

    if (!clientIP) return redirect(env.NEXT_PUBLIC_BASE_URL);

    const { data, error } = await supabaseAdmin.from("dev_access_ips").select("*").eq("ip_address", clientIP).eq("is_active", true).single();

    if (error) {
      console.error(error);
      // return redirect(env.NEXT_PUBLIC_BASE_URL);
    }

    if (!data) {
      // return redirect(env.NEXT_PUBLIC_BASE_URL);
    }
  }

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
