import SpotifySongRequestSettings from "@/components/forms/spotify-song-request-settings";
import React from "react";

export default function page() {
  return (
    <div className="hidden h-full  flex-1 flex-col  md:flex">
      <div className="flex items-center justify-between space-y-2 border rounded p-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight"> Song Request Settings</h2>
        </div>
        <div className="flex items-center space-x-2"></div>
      </div>
      <div className="flex items-center justify-between space-y-2 border rounded p-4 mt-4">
        <SpotifySongRequestSettings />
      </div>
    </div>
  );
}
