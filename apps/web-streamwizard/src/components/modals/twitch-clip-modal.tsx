import React from "react";

interface Props {
  url: string;
}

export default function TwitchClipModal({ url }: Props) {
  // Ensure proper URL formatting
  const formattedUrl = `${url}&parent=localhost&parent=streamwizard.org&parent=staging.streamwizard.org&autoplay=true`;

  return (
    <div className="w-[960px] mt-8">
      <iframe
        src={formattedUrl}
        height="480"
        width="100%"
        allowFullScreen // Enable fullscreen
      />
    </div>
  );
}
