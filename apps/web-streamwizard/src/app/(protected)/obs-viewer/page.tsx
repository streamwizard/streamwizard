import type { Metadata } from "next";
import { Suspense } from "react";
import { ObsViewerContent } from "@/components/irl/viewer/obs-viewer-content";
import { getObsPullHost } from "@/lib/obs/obs-pull-host";
import { requireProductAccess } from "@/lib/require-product-access";

export const metadata: Metadata = {
  title: "OBS desktop",
};

export default async function ObsViewerPage() {
  const [access, obsPullHost] = await Promise.all([requireProductAccess("cloud_obs"), getObsPullHost()]);

  return (
    <Suspense fallback={<div className="h-screen w-screen bg-black" />}>
      <ObsViewerContent canInteract={access.canInteract} obsPullHost={obsPullHost} />
    </Suspense>
  );
}
