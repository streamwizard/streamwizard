import type { Metadata } from "next";
import { Footer } from "@/components/public/layout/footer";
import Header from "@/components/public/layout/header";
import { NotFoundContent } from "@/components/public/not-found/not-found-content";
import { hasSessionCookie } from "@/lib/auth";

// Owning the metadata here matters: without this file Next's built-in
// not-found boundary and the root layout both emitted a <title> and a robots
// tag, so every 404 shipped two of each. Next always injects its own
// `<meta name="robots" content="noindex">` on a 404, so `robots: null` drops
// the inherited index/follow tag rather than adding a second noindex.
export const metadata: Metadata = {
  title: "Page not found",
  robots: null,
};

// Root-level so it catches every unmatched URL, which also means it renders
// outside (public)/layout.tsx. The header and footer are composed by hand so
// a dead link still lands on something that looks like the site. A notFound()
// thrown inside (public) renders (public)/not-found.tsx instead, which gets
// them from the layout.
export default async function NotFound() {
  const isAuthenticated = await hasSessionCookie();

  return (
    <>
      <Header isAuthenticated={isAuthenticated} />
      <main>
        <NotFoundContent />
      </main>
      <Footer />
    </>
  );
}
