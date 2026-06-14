import React from "react";

interface Props {
  url: string;
}

/**
 * Lightweight iframe-only clip player. Used by callers that only have an embed
 * URL (analytics viewer-count chart, event actions). The rich clips-page viewer
 * lives in `twitch-clip-dialog.tsx`.
 */
export default function TwitchClipModal({ url }: Props) {
  const formattedUrl = `${url}&parent=localhost&parent=streamwizard.org&parent=staging.streamwizard.org&autoplay=true`;

  return (
    <div className="mt-6 min-w-0 max-w-full overflow-x-hidden">
      <iframe
        src={formattedUrl}
        allowFullScreen
        className="aspect-video w-full rounded-md border border-border"
        title="Twitch clip preview"
      />
    </div>
  );
}
