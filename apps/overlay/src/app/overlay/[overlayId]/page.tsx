import { loadOverlaySceneByOverlayId } from "@/app/actions/overlay";
import { OverlaySceneCanvas } from "@/components/overlay/OverlaySceneCanvas";
import { notFound } from "next/navigation";

export default async function OverlayByIdPage({
  params,
}: {
  params: Promise<{ overlayId: string }>;
}) {
  const { overlayId } = await params;
  const result = await loadOverlaySceneByOverlayId(overlayId);

  if (!result.ok) {
    if (
      result.code === "SCENE_NOT_FOUND" ||
      result.code === "MISSING_LOOKUP"
    ) {
      notFound();
    }

    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#111",
          color: "#eee",
          fontFamily: "system-ui, sans-serif",
          padding: 24,
          textAlign: "center",
          boxSizing: "border-box",
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 18 }}>
            Could not load this overlay ({result.code}).
          </p>
          <p style={{ marginTop: 12, opacity: 0.85, fontSize: 15 }}>
            {result.message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "flex-start",
      }}
    >
      <OverlaySceneCanvas scene={result.scene} items={result.items} />
    </div>
  );
}
