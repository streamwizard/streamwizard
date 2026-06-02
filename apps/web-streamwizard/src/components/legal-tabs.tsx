"use client";

import { useState, type ReactNode } from "react";

interface LegalTabsProps {
  normal: ReactNode;
  genz: ReactNode;
}

export function LegalTabs({ normal, genz }: LegalTabsProps) {
  const [tab, setTab] = useState<"normal" | "genz">("normal");

  return (
    <>
      <div className="inline-flex rounded-lg border border-border overflow-hidden mb-10 text-xs font-medium">
        <button
          onClick={() => setTab("normal")}
          className={`px-4 py-2 transition-colors cursor-pointer ${
            tab === "normal" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Normal
        </button>
        <button
          onClick={() => setTab("genz")}
          className={`px-4 py-2 transition-colors cursor-pointer border-l border-border ${
            tab === "genz" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Gen-Z version ✨
        </button>
      </div>

      {tab === "normal" ? normal : genz}
    </>
  );
}
