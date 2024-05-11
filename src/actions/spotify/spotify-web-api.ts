'use server'

import { createClient } from "@/utils/supabase/server";

export async function SearchSongs(query: string) {
  const supabase = createClient();

  const {data, error} = await supabase.from('spotify_integration').select('access_token').single();

  if (error || !data) {
    return;
  }

  


}