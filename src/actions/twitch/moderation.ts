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

// ============================================
// Banned Users
// ============================================

export interface BannedUser {
  user_id: string;
  user_login: string;
  user_name: string;
  expires_at: string;
  created_at: string;
  reason: string;
  moderator_id: string;
  moderator_login: string;
  moderator_name: string;
}

interface GetBannedUsersResponse {
  data: BannedUser[];
  pagination: {
    cursor?: string;
  };
}

/**
 * Get banned users for the authenticated broadcaster
 */
export async function getBannedUsers(options?: { cursor?: string; first?: number }): Promise<ActionResponse<{ users: BannedUser[]; cursor?: string }>> {
  const supabase = await createClient();

  const { data: integration, error: dbError } = await supabase.from("integrations_twitch").select("twitch_user_id").single();

  if (dbError || !integration?.twitch_user_id) {
    return {
      success: false,
      message: "Twitch integration not found",
    };
  }

  try {
    const response = await TwitchAPI.get<GetBannedUsersResponse>("/moderation/banned", {
      params: {
        broadcaster_id: integration.twitch_user_id,
        first: options?.first ?? 20,
        after: options?.cursor,
      },
      broadcasterID: integration.twitch_user_id,
    });

    return {
      success: true,
      message: "Banned users fetched successfully",
      data: {
        users: response.data.data,
        cursor: response.data.pagination?.cursor,
      },
    };
  } catch (error) {
    console.error("Error fetching banned users:", error);
    const message = error instanceof AxiosError ? error.response?.data?.message || error.message : "Failed to fetch banned users";
    return {
      success: false,
      message,
    };
  }
}

/**
 * Check if a specific user is banned
 */
export async function getBannedUser(userId: string): Promise<ActionResponse<BannedUser | null>> {
  const supabase = await createClient();

  const { data: integration, error: dbError } = await supabase.from("integrations_twitch").select("twitch_user_id").single();

  if (dbError || !integration?.twitch_user_id) {
    return {
      success: false,
      message: "Twitch integration not found",
    };
  }

  try {
    const response = await TwitchAPI.get<GetBannedUsersResponse>("/moderation/banned", {
      params: {
        broadcaster_id: integration.twitch_user_id,
        user_id: userId,
      },
      broadcasterID: integration.twitch_user_id,
    });

    const user = response.data.data[0] || null;

    return {
      success: true,
      message: user ? "User is banned" : "User is not banned",
      data: user,
    };
  } catch (error) {
    console.error("Error checking banned user:", error);
    const message = error instanceof AxiosError ? error.response?.data?.message || error.message : "Failed to check banned user";
    return {
      success: false,
      message,
    };
  }
}

/**
 * Unban a user from the broadcaster's channel
 */
export async function unbanUser(userId: string): Promise<ActionResponse> {
  const supabase = await createClient();

  const { data: integration, error: dbError } = await supabase.from("integrations_twitch").select("twitch_user_id").single();

  if (dbError || !integration?.twitch_user_id) {
    return {
      success: false,
      message: "Twitch integration not found",
    };
  }

  try {
    await TwitchAPI.delete("/moderation/bans", {
      params: {
        broadcaster_id: integration.twitch_user_id,
        moderator_id: integration.twitch_user_id,
        user_id: userId,
      },
      broadcasterID: integration.twitch_user_id,
    });

    return {
      success: true,
      message: "User unbanned successfully",
    };
  } catch (error) {
    console.error("Error unbanning user:", error);
    const message = error instanceof AxiosError ? error.response?.data?.message || error.message : "Failed to unban user";
    return {
      success: false,
      message,
    };
  }
}

export interface BanUserInput {
  userId: string;
  duration?: number; // seconds, undefined = permanent ban
  reason?: string;
}

interface BanUserResponse {
  data: {
    broadcaster_id: string;
    moderator_id: string;
    user_id: string;
    created_at: string;
    end_time: string | null;
  }[];
}

/**
 * Ban a user or put them in a timeout
 * @param input.userId - The ID of the user to ban
 * @param input.duration - Timeout duration in seconds (1-1209600). Omit for permanent ban.
 * @param input.reason - Optional reason for the ban (max 500 chars)
 */
export async function banUser(input: BanUserInput): Promise<ActionResponse<{ endTime: string | null }>> {
  const supabase = await createClient();

  const { data: integration, error: dbError } = await supabase.from("integrations_twitch").select("twitch_user_id").single();

  if (dbError || !integration?.twitch_user_id) {
    return {
      success: false,
      message: "Twitch integration not found",
    };
  }

  // Validate duration if provided
  if (input.duration !== undefined) {
    if (input.duration < 1 || input.duration > 1209600) {
      return {
        success: false,
        message: "Timeout duration must be between 1 second and 2 weeks (1,209,600 seconds)",
      };
    }
  }

  // Validate reason length
  if (input.reason && input.reason.length > 500) {
    return {
      success: false,
      message: "Reason must be 500 characters or less",
    };
  }

  try {
    const body: { user_id: string; duration?: number; reason?: string } = {
      user_id: input.userId,
    };

    if (input.duration !== undefined) {
      body.duration = input.duration;
    }

    if (input.reason) {
      body.reason = input.reason;
    }

    const response = await TwitchAPI.post<BanUserResponse>(
      "/moderation/bans",
      { data: body },
      {
        params: {
          broadcaster_id: integration.twitch_user_id,
          moderator_id: integration.twitch_user_id,
        },
        broadcasterID: integration.twitch_user_id,
      },
    );

    const result = response.data.data[0];

    return {
      success: true,
      message: input.duration ? "User put in timeout successfully" : "User banned successfully",
      data: {
        endTime: result.end_time,
      },
    };
  } catch (error) {
    console.error("Error banning user:", error);
    const message = error instanceof AxiosError ? error.response?.data?.message || error.message : "Failed to ban user";
    return {
      success: false,
      message,
    };
  }
}
