import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Not found — StreamWizard Overlay",
  robots: { index: false, follow: false },
};

export default function NotFound() {
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
        Page not found
      </h1>
      <p
        style={{
          margin: "16px 0 0",
          maxWidth: 420,
          fontSize: 15,
          lineHeight: 1.5,
          opacity: 0.75,
        }}
      >
        This host only serves overlay URLs from your StreamWizard dashboard,
        for example a path like `/overlay/` followed by your scene UUID or
        slug. If you followed a link here, it may be wrong or expired.
      </p>
      <p style={{ margin: "24px 0 0", fontSize: 14, opacity: 0.55 }}>
        <a
          href="https://streamwizard.org"
          style={{ color: "#93c5fd", textDecoration: "none" }}
          rel="noopener noreferrer"
        >
          streamwizard.org
        </a>
        {" — dashboard & account"}
      </p>
    </div>
  );
}
