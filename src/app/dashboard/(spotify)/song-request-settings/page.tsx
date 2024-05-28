import { auth } from "@/auth";
import SpotifySongRequestSettings from "@/components/forms/spotify-song-request-settings";
import { createClient } from "@/lib/supabase/server";
import React from "react";

export default async function page() {
  const session = await auth();
  if (!session) return null;

  const supabase = createClient(session?.supabaseAccessToken as string);

  const {data} = await supabase.from("spotify_settings").select("*").single();

  if (!data) {
    return null;
  }





  return (
    <div className="hidden h-full  flex-1 flex-col  md:flex">
      <div className="flex items-center justify-between space-y-2 border rounded p-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight"> Song Request Settings</h2>
        </div>
        <div className="flex items-center space-x-2"></div>
      </div>
      <div className="flex items-center justify-between space-y-2 border rounded p-4 mt-4">
        <SpotifySongRequestSettings settings={data} />
      </div>
    </div>
  );
}
