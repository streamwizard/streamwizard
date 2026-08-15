import { Footer } from "@/components/public/layout/footer";
import Header from "@/components/public/layout/header";
import { ScrollToTop } from "@/components/buttons/scroll-to-top";
import { JsonLd } from "@/components/seo/json-ld";
import { organizationSchema } from "@/lib/seo";

// No metadata export here on purpose. This layout used to duplicate the root's
// title/description with different wording, so the two disagreed about what the
// product is. Public pages now inherit the root metadata and override per page.

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <JsonLd schema={organizationSchema()} />
      <Header />
      <main>{children}</main>
      <Footer />
      <ScrollToTop />
    </>
  );
}
