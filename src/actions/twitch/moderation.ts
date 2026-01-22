"use server";

import { TwitchAPI } from "@/lib/axios/twitch-api";
import { createClient } from "@/lib/supabase/server";
import { AxiosError } from "axios";

interface ActionResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

export interface AutoModSettings {
  broadcaster_id: string;
  moderator_id: string;
  overall_level: number | null;
  disability: number;
  aggression: number;
  sexuality_sex_or_gender: number;
  misogyny: number;
  bullying: number;
  swearing: number;
  race_ethnicity_or_religion: number;
  sex_based_terms: number;
}

interface GetAutoModSettingsResponse {
  data: AutoModSettings[];
}

/**
 * Get AutoMod settings for the authenticated broadcaster
 */
export async function getAutoModSettings(): Promise<ActionResponse<AutoModSettings>> {
  const supabase = await createClient();

  const { data: integration, error: dbError } = await supabase.from("integrations_twitch").select("twitch_user_id").single();

  if (dbError || !integration?.twitch_user_id) {
    return {
      success: false,
      message: "Twitch integration not found",
    };
  }

  try {
    const response = await TwitchAPI.get<GetAutoModSettingsResponse>("/moderation/automod/settings", {
      params: {
        broadcaster_id: integration.twitch_user_id,
        moderator_id: integration.twitch_user_id,
      },
      broadcasterID: integration.twitch_user_id,
    });

    if (!response.data.data || response.data.data.length === 0) {
      return {
        success: false,
        message: "No AutoMod settings found",
      };
    }

    return {
      success: true,
      message: "AutoMod settings fetched successfully",
      data: response.data.data[0],
    };
  } catch (error) {
    console.error("Error fetching AutoMod settings:", error);
    const message = error instanceof AxiosError ? error.response?.data?.message || error.message : "Failed to fetch AutoMod settings";
    return {
      success: false,
      message,
    };
  }
}

export interface UpdateAutoModSettingsInput {
  overall_level?: number;
  disability?: number;
  aggression?: number;
  sexuality_sex_or_gender?: number;
  misogyny?: number;
  bullying?: number;
  swearing?: number;
  race_ethnicity_or_religion?: number;
  sex_based_terms?: number;
}

/**
 * Update AutoMod settings for the authenticated broadcaster
 * Either set overall_level OR individual settings, not both
 */
export async function updateAutoModSettings(settings: UpdateAutoModSettingsInput): Promise<ActionResponse<AutoModSettings>> {
  const supabase = await createClient();

  const { data: integration, error: dbError } = await supabase.from("integrations_twitch").select("twitch_user_id").single();

  if (dbError || !integration?.twitch_user_id) {
    return {
      success: false,
      message: "Twitch integration not found",
    };
  }

  // Validate that values are between 0-4
  const values = Object.values(settings).filter((v): v is number => typeof v === "number");
  if (values.some((v) => v < 0 || v > 4)) {
    return {
      success: false,
      message: "All AutoMod levels must be between 0 and 4",
    };
  }

  try {
    const response = await TwitchAPI.put<GetAutoModSettingsResponse>("/moderation/automod/settings", settings, {
      params: {
        broadcaster_id: integration.twitch_user_id,
        moderator_id: integration.twitch_user_id,
      },
      broadcasterID: integration.twitch_user_id,
    });

    if (!response.data.data || response.data.data.length === 0) {
      return {
        success: false,
        message: "Failed to update AutoMod settings",
      };
    }

    return {
      success: true,
      message: "AutoMod settings updated successfully",
      data: response.data.data[0],
    };
  } catch (error) {
    console.error("Error updating AutoMod settings:", error);
    const message = error instanceof AxiosError ? error.response?.data?.message || error.message : "Failed to update AutoMod settings";
    return {
      success: false,
      message,
    };
  }
}
