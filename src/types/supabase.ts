/* eslint-disable */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: { PostgrestVersion: "12.2.2 (db9da0b)" }
  public: {
    Tables: {
      clip_folder_junction: {
        Row: { clip_id: string; created_at: string | null; folder_id: number | null; id: number; user_id: string | null }
        Insert: { clip_id: string; created_at?: string | null; folder_id?: number | null; id?: number; user_id?: string | null }
        Update: { clip_id?: string; created_at?: string | null; folder_id?: number | null; id?: number; user_id?: string | null }
        Relationships: [
          { foreignKeyName: "clip_folder_junction_folder_id_fkey"; columns: ["folder_id"]; isOneToOne: false; referencedRelation: "clip_folders"; referencedColumns: ["id"] }
        ]
      }
      clip_folders: {
        Row: { created_at: string | null; href: string; id: number; name: string; parent_folder_id: number | null; updated_at: string | null; user_id: string }
        Insert: { created_at?: string | null; href: string; id?: number; name: string; parent_folder_id?: number | null; updated_at?: string | null; user_id: string }
        Update: { created_at?: string | null; href?: string; id?: number; name?: string; parent_folder_id?: number | null; updated_at?: string | null; user_id?: string }
        Relationships: [
          { foreignKeyName: "clip_folders_parent_folder_id_fkey"; columns: ["parent_folder_id"]; isOneToOne: false; referencedRelation: "clip_folders"; referencedColumns: ["id"] }
        ]
      }
      clips: {
        Row: { broadcaster_id: string; broadcaster_name: string; created_at: string; created_at_twitch: string; creator_id: string; creator_name: string; duration: number | null; embed_url: string | null; game_id: string | null; game_name: string | null; id: number; is_featured: boolean; language: string | null; thumbnail_url: string | null; title: string; twitch_clip_id: string; url: string; user_id: string; video_id: string | null; view_count: number | null; vod_offset: number | null }
        Insert: { broadcaster_id: string; broadcaster_name: string; created_at?: string; created_at_twitch: string; creator_id: string; creator_name: string; duration?: number | null; embed_url?: string | null; game_id?: string | null; game_name?: string | null; id?: number; is_featured?: boolean; language?: string | null; thumbnail_url?: string | null; title: string; twitch_clip_id: string; url: string; user_id: string; video_id?: string | null; view_count?: number | null; vod_offset?: number | null }
        Update: { broadcaster_id?: string; broadcaster_name?: string; created_at?: string; created_at_twitch?: string; creator_id?: string; creator_name?: string; duration?: number | null; embed_url?: string | null; game_id?: string | null; game_name?: string | null; id?: number; is_featured?: boolean; language?: string | null; thumbnail_url?: string | null; title?: string; twitch_clip_id?: string; url?: string; user_id?: string; video_id?: string | null; view_count?: number | null; vod_offset?: number | null }
        Relationships: [
          { foreignKeyName: "clips_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] }
        ]
      }
      command_logs: {
        Row: { channel_id: string; command_id: string | null; id: number; used_at: string | null; user_name: string }
        Insert: { channel_id: string; command_id?: string | null; id?: number; used_at?: string | null; user_name: string }
        Update: { channel_id?: string; command_id?: string | null; id?: number; used_at?: string | null; user_name?: string }
        Relationships: [
          { foreignKeyName: "command_logs_command_id_fkey"; columns: ["command_id"]; isOneToOne: false; referencedRelation: "commands"; referencedColumns: ["id"] }
        ]
      }
      commands: {
        Row: { channel_id: string; cooldown_seconds: number | null; created_at: string | null; id: string; permission: string; response: string; shared: boolean | null; trigger: string; updated_at: string | null; usage_count: number | null }
        Insert: { channel_id: string; cooldown_seconds?: number | null; created_at?: string | null; id?: string; permission?: string; response: string; shared?: boolean | null; trigger: string; updated_at?: string | null; usage_count?: number | null }
        Update: { channel_id?: string; cooldown_seconds?: number | null; created_at?: string | null; id?: string; permission?: string; response?: string; shared?: boolean | null; trigger?: string; updated_at?: string | null; usage_count?: number | null }
        Relationships: [
          { foreignKeyName: "commands_channel_id_fkey"; columns: ["channel_id"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] }
        ]
      }
      dev_access_ips: {
        Row: { access_level: string | null; created_at: string | null; description: string | null; id: string; ip_address: string; is_active: boolean | null; owner: string; updated_at: string | null }
        Insert: { access_level?: string | null; created_at?: string | null; description?: string | null; id?: string; ip_address: string; is_active?: boolean | null; owner: string; updated_at?: string | null }
        Update: { access_level?: string | null; created_at?: string | null; description?: string | null; id?: string; ip_address?: string; is_active?: boolean | null; owner?: string; updated_at?: string | null }
        Relationships: []
      }
      integrations: {
        Row: { created_at: string; id: string; is_active: boolean | null; type: Database["public"]["Enums"]["provider_type"]; updated_at: string; user_id: string }
        Insert: { created_at?: string; id?: string; is_active?: boolean | null; type: Database["public"]["Enums"]["provider_type"]; updated_at?: string; user_id: string }
        Update: { created_at?: string; id?: string; is_active?: boolean | null; type?: Database["public"]["Enums"]["provider_type"]; updated_at?: string; user_id?: string }
        Relationships: [
          { foreignKeyName: "integrations_user_id_fkey"; columns: ["user_id"]; isOneToOne: true; referencedRelation: "users"; referencedColumns: ["id"] }
        ]
      }
      integrations_twitch: {
        Row: { access_token: string | null; broadcaster_type: string | null; created_at: string; description: string | null; email: string | null; id: string; profile_image_url: string | null; refresh_token: string | null; token_expires_at: string | null; twitch_user_id: string; twitch_username: string; updated_at: string; user_id: string }
        Insert: { access_token?: string | null; broadcaster_type?: string | null; created_at?: string; description?: string | null; email?: string | null; id: string; profile_image_url?: string | null; refresh_token?: string | null; token_expires_at?: string | null; twitch_user_id: string; twitch_username: string; updated_at?: string; user_id: string }
        Update: { access_token?: string | null; broadcaster_type?: string | null; created_at?: string; description?: string | null; email?: string | null; id?: string; profile_image_url?: string | null; refresh_token?: string | null; token_expires_at?: string | null; twitch_user_id?: string; twitch_username?: string; updated_at?: string; user_id?: string }
        Relationships: [
          { foreignKeyName: "integrations_twitch_id_fkey"; columns: ["id"]; isOneToOne: true; referencedRelation: "integrations"; referencedColumns: ["id"] },
          { foreignKeyName: "integrations_twitch_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] }
        ]
      }
      timers: {
        Row: { channel_id: string; created_at: string | null; enabled: boolean | null; id: string; interval_minutes: number; last_sent_at: string | null; message: string }
        Insert: { channel_id: string; created_at?: string | null; enabled?: boolean | null; id?: string; interval_minutes?: number; last_sent_at?: string | null; message: string }
        Update: { channel_id?: string; created_at?: string | null; enabled?: boolean | null; id?: string; interval_minutes?: number; last_sent_at?: string | null; message?: string }
        Relationships: [
          { foreignKeyName: "timers_channel_id_fkey"; columns: ["channel_id"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] }
        ]
      }
      twitch_clip_syncs: {
        Row: { clip_count: number; created_at: string | null; id: number; last_sync: string; sync_status: string; updated_at: string | null; user_id: string }
        Insert: { clip_count: number; created_at?: string | null; id?: number; last_sync: string; sync_status: string; updated_at?: string | null; user_id: string }
        Update: { clip_count?: number; created_at?: string | null; id?: number; last_sync?: string; sync_status?: string; updated_at?: string | null; user_id?: string }
        Relationships: []
      }
      user_preferences: {
        Row: { created_at: string | null; id: string; sync_clips_on_end: boolean; theme: Database["public"]["Enums"]["theme_type"] | null; updated_at: string | null; user_id: string }
        Insert: { created_at?: string | null; id?: string; sync_clips_on_end?: boolean; theme?: Database["public"]["Enums"]["theme_type"] | null; updated_at?: string | null; user_id: string }
        Update: { created_at?: string | null; id?: string; sync_clips_on_end?: boolean; theme?: Database["public"]["Enums"]["theme_type"] | null; updated_at?: string | null; user_id?: string }
        Relationships: []
      }
      users: {
        Row: { avatar_url: string | null; created_at: string; email: string; id: string; name: string; role: string; updated_at: string }
        Insert: { avatar_url?: string | null; created_at?: string; email: string; id: string; name: string; role?: string; updated_at?: string }
        Update: { avatar_url?: string | null; created_at?: string; email?: string; id?: string; name?: string; role?: string; updated_at?: string }
        Relationships: []
      }
      whitelist: {
        Row: { email: string; id: number; whitelisted: boolean }
        Insert: { email: string; id?: number; whitelisted?: boolean }
        Update: { email?: string; id?: number; whitelisted?: boolean }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      add_clip_to_folder: { Args: { p_clip_id: string; p_folder_id: string }; Returns: undefined }
      get_all_clips_with_folders: { Args: Record<PropertyKey, never>; Returns: { id: number; title: string; twitch_clip_id: string; creator_name: string; game_name: string; url: string; thumbnail_url: string; created_at: string; view_count: number; duration: number; broadcaster_name: string; created_at_twitch: string; user_id: string; embed_url: string; broadcaster_id: string; creator_id: string; video_id: string; game_id: string; language: string; vod_offset: number; is_featured: boolean; folders: Json }[] }
      get_clips_by_folder: { Args: { folder_href: string }; Returns: { id: number; title: string; twitch_clip_id: string; creator_name: string; game_name: string; url: string; thumbnail_url: string; created_at: string; view_count: number; duration: number; broadcaster_name: string; created_at_twitch: string; user_id: string; embed_url: string; broadcaster_id: string; creator_id: string; video_id: string; game_id: string; language: string; vod_offset: number; is_featured: boolean; folders: Json }[] }
      insert_discord_integration: { Args: { integration_id: string; provider_data: Json; user_id: string }; Returns: undefined }
      insert_integration: { Args: { p_user_id: string; p_provider_type: Database["public"]["Enums"]["provider_type"] }; Returns: string }
      insert_twitch_integration: { Args: { integration_id: string; provider_data: Json; user_id: string }; Returns: undefined }
      remove_clip_from_folder: { Args: { p_clip_id: string; p_folder_id: string }; Returns: undefined }
    }
    Enums: {
      actions: ["spotify.song_request", "spotify.add_banned_song", "spotify.remove_banned_song", "spotify.add_banned_chatter", "spotify.remove_banned_chatter", "spotify.skip", "none"]
      provider_type: ["twitch", "discord"]
      roles: ["user", "beta", "admin"]
      theme_type: ["dark", "light", "system"]
      userlevel: ["everyone", "follower", "vip", "subscriber", "moderator", "super_moderator", "broadcaster"]
    }
    CompositeTypes: { [_ in never]: never }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"]) : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends { Row: infer R } ? R : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends { Row: infer R } ? R : never : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends { Insert: infer I } ? I : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Insert: infer I } ? I : never : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends { Update: infer U } ? U : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Update: infer U } ? U : never : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"] : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions] : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"] : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"] ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions] : never

export const Constants = {
  public: {
    Enums: {
      actions: ["spotify.song_request", "spotify.add_banned_song", "spotify.remove_banned_song", "spotify.add_banned_chatter", "spotify.remove_banned_chatter", "spotify.skip", "none"],
      provider_type: ["twitch", "discord"],
      roles: ["user", "beta", "admin"],
      theme_type: ["dark", "light", "system"],
      userlevel: ["everyone", "follower", "vip", "subscriber", "moderator", "super_moderator", "broadcaster"],
    },
  },
} as const


