import { Footer } from "@/components/public/layout/footer";
import Header from "@/components/public/layout/header";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "StreamWizard",
  description:
    "StreamWizard helps you organize your Twitch clips effortlessly. Search by category, creator, title, date range, and more. Create custom folders to keep your clips perfectly organized.",
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
  return (
    <>
      <Header />
      {children}
      <Footer />
    </>
  );
}
