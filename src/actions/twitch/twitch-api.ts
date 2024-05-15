"use server";
import { TwitchAPI } from "@/config/axios/twitch-api";
import { ChannelPointSchema } from "@/schemas/channelpoint-schema";
import { ChannelSearchResults, TwitchChannelPointsResponse, TwitchChannelPointsReward, getTwitchUserResponse } from "@/types/API/twitch";
import { ChannelpointsDatabaseColumns } from "@/types/database/twitch-channelpoints";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function searchChatter(value: string, first: number = 10) {
  // get the tokens from the database
  const supabase = createClient();

  const { data, error: DBerror } = await supabase.from("twitch_integration").select("access_token, broadcaster_id").single();

  if (DBerror) {
    console.log("Tokens not found");
    return null;
  }

  try {
    const res = await TwitchAPI.get<ChannelSearchResults>(`/search/channels`, {
      params: {
        query: value,
        first: first,
      },

      headers: {
        Authorization: `Bearer ${data.access_token}`,
        "client-id": process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID,
      },
      broadcasterID: data.broadcaster_id,
    });
    return res.data.data;
  } catch (error) {
    console.log(error);
    return null;
  }
}

export async function getUser({ id }: { id: string }) {
  // get broadcaster_id
  const supabase = createClient();
  const { data, error: DBerror } = await supabase.from("twitch_integration").select("access_token, broadcaster_id").single();

  if (DBerror) {
    console.log("Tokens not found");
    return null;
  }

  try {
    const res = await TwitchAPI.get<getTwitchUserResponse>(`/users`, {
      params: {
        id: id,
      },
      broadcasterID: data.broadcaster_id,
      headers: {
        Authorization: `Bearer ${data.access_token}`,
      },
    });

    return res.data.data;
  } catch (error) {
    console.log(error);
  }
}

// channelpoints

// get all the channel points for song requests
export async function getChannelPoints(): Promise<TwitchChannelPointsReward[] | null> {
  // get broadcaster_id
  const supabase = createClient();
  const { data, error: DBerror } = await supabase.from("twitch_integration").select("access_token, broadcaster_id, twitch_channelpoints(*)").single();

  if (DBerror) {
    console.log("Tokens not found");
    return null;
  }

  const ids: string | undefined = data.twitch_channelpoints.map((x: ChannelpointsDatabaseColumns) => x.channelpoint_id).join("&id=");

  if (!ids) return [];

  try {
    const res = await TwitchAPI.get<TwitchChannelPointsResponse>(`/channel_points/custom_rewards?broadcaster_id=${data.broadcaster_id}&id=${ids}`, {
      headers: {
        Authorization: `Bearer ${data.access_token}`,
      },
      broadcasterID: data.broadcaster_id,
    });

    const response: TwitchChannelPointsReward[] = res.data.data.map((x) => {
      const action = data.twitch_channelpoints.find((y: ChannelpointsDatabaseColumns) => y.channelpoint_id === x.id);
      return {
        ...x,
        action: action?.action,
      };
    });

    return response;
  } catch (error) {
    console.log(error);
    throw error;
  }
}

// create a channel point
export async function createChannelPoint(data: ChannelPointSchema) {
  // get broadcaster_id
  const supabase = createClient();
  const { data: tokens, error: DBerror } = await supabase.from("twitch_integration").select("access_token, broadcaster_id, user_id").single();

  if (DBerror) {
    console.log("Tokens not found");
    return null;
  }

  try {
    let res = await TwitchAPI.post<TwitchChannelPointsResponse>(`/channel_points/custom_rewards?broadcaster_id=${tokens.broadcaster_id}`, data, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
      broadcasterID: tokens.broadcaster_id,
    });

    const newReward = res.data.data[0];

    // add the data to the database
    const { error } = await supabase.from("twitch_channelpoints").insert({
      user_id: tokens.user_id,
      broadcaster_id: +newReward.broadcaster_id,
      channelpoint_id: newReward.id,
      action: data.action,
    });

    if (error) {
      console.log(error);
      console.log("Error inserting into the database");

      await TwitchAPI.delete(`/channel_points/custom_rewards?broadcaster_id=${tokens.broadcaster_id}&id=${newReward.id}`, {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
        broadcasterID: tokens.broadcaster_id,
      });
    }

    revalidatePath("/dashboard/channelpoints");

    return res.data.data;
  } catch (error) {
    throw error;
  }
}

// delete a channel point
export async function deleteChannelPoint(id: string) {
  // get broadcaster_id
  const supabase = createClient();
  const { data, error: DBerror } = await supabase.from("twitch_integration").select("access_token, broadcaster_id").single();

  if (DBerror) {
    console.log("Tokens not found");
    return null;
  }

  try {
    const res = await TwitchAPI.delete(`/channel_points/custom_rewards?broadcaster_id=${data.broadcaster_id}&id=${id}`, {
      headers: {
        Authorization: `Bearer ${data.access_token}`,
      },
      broadcasterID: data.broadcaster_id,
    });

    // remove the data from the database
    await supabase.from("twitch_channelpoints").delete().eq("channelpoint_id", id);
    revalidatePath("/dashboard/channelpoints");
    return res.data.data;
  } catch (error) {
    throw error;
  }
}

// update a channel point
export async function updateChannelpoint(channelpoint: ChannelPointSchema, channelpoint_id: string) {
  // get broadcaster_id
  const supabase = createClient();
  const { data: tokens, error: DBerror } = await supabase.from("twitch_integration").select("access_token, broadcaster_id").single();

  if (DBerror) {
    console.log("Tokens not found");
    return null;
  }


  try {
    const res = await TwitchAPI.patch<TwitchChannelPointsResponse>(
      `/channel_points/custom_rewards?broadcaster_id=${tokens.broadcaster_id}&id=${channelpoint_id}`,
      channelpoint,
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
        broadcasterID: tokens.broadcaster_id,
      }
    );

    // update the database
    await supabase.from("twitch_channelpoints").update({ action: channelpoint.action }).eq("channelpoint_id", channelpoint_id);



    revalidatePath("/dashboard/channelpoints");
    return res.data.data;
  } catch (error: any) {
    console.log(error.resposne);
    throw error;
  }
}
