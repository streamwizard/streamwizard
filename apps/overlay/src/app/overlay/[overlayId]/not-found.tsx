import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Overlay not found — StreamWizard Overlay",
  robots: { index: false, follow: false },
};

/**
 * Shown when `notFound()` is called from `/overlay/[overlayId]` (missing slug/id or inactive slug).
 */
export default function OverlayNotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        boxSizing: "border-box",
        background: "#0a0a0a",
        color: "#e5e5e5",
        fontFamily:
          "var(--font-geist-sans), system-ui, -apple-system, sans-serif",
        textAlign: "center",
      }}
    >
      <p style={{ margin: 0, fontSize: 13, letterSpacing: "0.08em", opacity: 0.5 }}>
        404
      </p>
      <h1 style={{ margin: "12px 0 0", fontSize: 22, fontWeight: 600 }}>
        Overlay not found
      </h1>
      <p
        style={{
          margin: "16px 0 0",
          maxWidth: 440,
          fontSize: 15,
          lineHeight: 1.5,
          opacity: 0.75,
        }}
      >
        There is no overlay scene for this link. Check that the id or slug is
        correct, that the scene is active (for slug URLs), and copy the overlay
        URL again from your dashboard.
      </p>
      <p style={{ margin: "24px 0 0", fontSize: 14, opacity: 0.55 }}>
        <a
          href="https://streamwizard.org"
          style={{ color: "#93c5fd", textDecoration: "none" }}
          rel="noopener noreferrer"
        >
          streamwizard.org
        </a>
        {" — open the dashboard"}
      </p>
    </div>
  );
}
