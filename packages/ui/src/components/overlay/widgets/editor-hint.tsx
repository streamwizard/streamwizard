"use client";

/**
 * The editor's placeholder for a live widget with nothing to show: a dashed
 * box with a title and what to do. Never rendered on the live overlay.
 * `compact` fits it into small widgets (the ad heads-up).
 */
export function EditorHint({ title, body, compact = false }: { title: string; body: string; compact?: boolean }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        border: "1.5px dashed rgba(158,122,255,0.5)",
        borderRadius: 8,
        color: "rgba(255,255,255,0.6)",
        fontFamily: "sans-serif",
        fontSize: compact ? 13 : 14,
        lineHeight: compact ? 1.35 : 1.4,
        textAlign: "center",
        padding: compact ? 10 : 12,
        ...(compact ? { overflow: "hidden" } : {}),
      }}
    >
      <strong style={{ color: "rgba(255,255,255,0.85)", fontSize: compact ? 14 : 15 }}>{title}</strong>
      <span>{body}</span>
    </div>
  );
}
