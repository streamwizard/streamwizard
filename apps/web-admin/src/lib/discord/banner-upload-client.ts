/** Browser side of a banner upload: stores the file through the upload route and resolves to its public URL. */
export async function uploadBanner(file: File): Promise<string> {
  const body = new FormData();
  body.set("file", file);
  const res = await fetch("/api/discord/banner-upload", { method: "POST", body });
  const payload = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !payload.url) throw new Error(payload.error ?? "Couldn't upload that image. Try again?");
  return payload.url;
}
