import { toast } from "sonner";

type DownloadClipLayout = "landscape" | "portrait";

type DownloadClipOptions = {
  clipId: string;
  layout: DownloadClipLayout;
  broadcaster_id: string;
  title?: string | null;
};

export async function downloadClip({ clipId, layout, broadcaster_id, title }: DownloadClipOptions) {
  const loadingToast = toast.loading(`Preparing ${layout} download...`);

  try {
    const response = await fetch("/api/twitch/download-clip", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clipId,
        layout,
        broadcaster_id,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to download clip");
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `${title || "clip"}-${layout}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl);
    }, 100);

    toast.dismiss(loadingToast);
    toast.success(`Downloading ${layout} clip...`);
  } catch (error) {
    toast.dismiss(loadingToast);
    toast.error(error instanceof Error ? error.message : "Failed to download clip");
  }
}
