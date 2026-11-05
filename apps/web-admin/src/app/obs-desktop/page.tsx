"use client";

import { Suspense } from "react";
import { DesktopOnly } from "@/components/shared/page/desktop-only";
import { AdminObsDesktopView } from "@/components/obs/admin-obs-desktop-view";

export default function AdminObsDesktopPage() {
  return (
    // A desktop session scaled into a phone is unusable; say so instead.
    <div className="min-h-screen p-4 md:p-0">
      <DesktopOnly tool="The OBS desktop viewer" backHref="/obs" backLabel="Back to OBS nodes">
        <Suspense fallback={<div className="h-screen w-screen bg-black" />}>
          <AdminObsDesktopView />
        </Suspense>
      </DesktopOnly>
    </div>
  );
}
