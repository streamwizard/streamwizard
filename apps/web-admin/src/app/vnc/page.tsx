"use client";

import { Suspense } from "react";
import { DesktopOnly } from "@/components/shared/page/desktop-only";
import { AdminVncView } from "@/components/obs/admin-vnc-view";

export default function AdminVncPage() {
  return (
    // A desktop session scaled into a phone is unusable; say so instead.
    <div className="min-h-screen p-4 md:p-0">
      <DesktopOnly tool="The VNC viewer" backHref="/obs" backLabel="Back to OBS nodes">
        <Suspense fallback={<div className="h-screen w-screen bg-black" />}>
          <AdminVncView />
        </Suspense>
      </DesktopOnly>
    </div>
  );
}
