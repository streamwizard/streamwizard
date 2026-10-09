/** The file's own pixel size, or null when it cannot be read. */
export function readMediaSize(url: string, isVideo: boolean): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const done = (w: number, h: number) => resolve(w > 0 && h > 0 ? { w, h } : null);
    if (isVideo) {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => done(video.videoWidth, video.videoHeight);
      video.onerror = () => resolve(null);
      video.src = url;
    } else {
      const image = new Image();
      image.onload = () => done(image.naturalWidth, image.naturalHeight);
      image.onerror = () => resolve(null);
      image.src = url;
    }
  });
}
