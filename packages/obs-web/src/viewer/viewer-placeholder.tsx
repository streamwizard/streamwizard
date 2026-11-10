"use client";

// What the viewer window shows before CloudOBSViewer can start: while the app
// looks up the instance's node, or when that lookup failed.
export function CloudOBSViewerPlaceholder({ error, pending }: { error: string | null; pending: string }) {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-black">
      {error ? (
        <>
          <p className="text-sm text-red-400">{error}</p>
          <button
            type="button"
            className="text-xs text-white/40 underline underline-offset-2"
            onClick={() => window.close()}
          >
            Close window
          </button>
        </>
      ) : (
        <p className="text-sm text-white/60">{pending}</p>
      )}
    </div>
  );
}
