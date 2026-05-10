"use server";
import { TwitchAPI } from "@/lib/axios/twitch-api";

export async function getAdSchedule(userId: string) {
  const res = await TwitchAPI.get(`channels/ads?broadcaster_id=${userId}`, {
    broadcasterID: userId,
  });
  return res.data;
}
