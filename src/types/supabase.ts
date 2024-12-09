export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      clip_folder_junction: {
        Row: {
          clip_id: number | null
          created_at: string | null
          folder_id: number | null
          id: number
          user_id: string | null
        }
        Insert: {
          clip_id?: number | null
          created_at?: string | null
          folder_id?: number | null
          id?: number
          user_id?: string | null
        }
        Update: {
          clip_id?: number | null
          created_at?: string | null
          folder_id?: number | null
          id?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clip_folder_junction_clip_id_fkey"
            columns: ["clip_id"]
            isOneToOne: false
            referencedRelation: "clips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clip_folder_junction_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "clip_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      clip_folders: {
        Row: {
          created_at: string | null
          href: string
          id: number
          name: string
          parent_folder_id: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          href: string
          id?: number
          name: string
          parent_folder_id?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          href?: string
          id?: number
          name?: string
          parent_folder_id?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clip_folders_parent_folder_id_fkey"
            columns: ["parent_folder_id"]
            isOneToOne: false
            referencedRelation: "clip_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      clips: {
        Row: {
          broadcaster_id: string
          broadcaster_name: string
          created_at: string
          created_at_twitch: string
          creator_id: string
          creator_name: string
          duration: number | null
          embed_url: string | null
          game_id: string | null
          game_name: string | null
          id: number
          is_featured: boolean
          language: string | null
          thumbnail_url: string | null
          title: string
          twitch_clip_id: string
          url: string
          user_id: string
          video_id: string | null
          view_count: number | null
          vod_offset: number | null
        }
        Insert: {
          broadcaster_id: string
          broadcaster_name: string
          created_at?: string
          created_at_twitch: string
          creator_id: string
          creator_name: string
          duration?: number | null
          embed_url?: string | null
          game_id?: string | null
          game_name?: string | null
          id?: number
          is_featured?: boolean
          language?: string | null
          thumbnail_url?: string | null
          title: string
          twitch_clip_id: string
          url: string
          user_id: string
          video_id?: string | null
          view_count?: number | null
          vod_offset?: number | null
        }
        Update: {
          broadcaster_id?: string
          broadcaster_name?: string
          created_at?: string
          created_at_twitch?: string
          creator_id?: string
          creator_name?: string
          duration?: number | null
          embed_url?: string | null
          game_id?: string | null
          game_name?: string | null
          id?: number
          is_featured?: boolean
          language?: string | null
          thumbnail_url?: string | null
          title?: string
          twitch_clip_id?: string
          url?: string
          user_id?: string
          video_id?: string | null
          view_count?: number | null
          vod_offset?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clips_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      commands: {
        Row: {
          action: string
          broadcaster_id: number
          command: string
          cooldown: number | null
          created_at: string
          id: string
          message: string
          status: boolean
          updated_at: string | null
          updated_by: string | null
          user_id: string
          userlevel: string
        }
        Insert: {
          action: string
          broadcaster_id: number
          command: string
          cooldown?: number | null
          created_at?: string
          id?: string
          message: string
          status?: boolean
          updated_at?: string | null
          updated_by?: string | null
          user_id: string
          userlevel: string
        }
        Update: {
          action?: string
          broadcaster_id?: number
          command?: string
          cooldown?: number | null
          created_at?: string
          id?: string
          message?: string
          status?: boolean
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
          userlevel?: string
        }
        Relationships: [
          {
            foreignKeyName: "commands_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          type: Database["public"]["Enums"]["provider_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          type: Database["public"]["Enums"]["provider_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          type?: Database["public"]["Enums"]["provider_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations_discord: {
        Row: {
          access_token: string | null
          avatar: string | null
          created_at: string
          discord_user_id: string
          discord_username: string
          email: string | null
          id: string
          refresh_token: string | null
          roles: Json | null
          server_id: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          avatar?: string | null
          created_at?: string
          discord_user_id: string
          discord_username: string
          email?: string | null
          id: string
          refresh_token?: string | null
          roles?: Json | null
          server_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          avatar?: string | null
          created_at?: string
          discord_user_id?: string
          discord_username?: string
          email?: string | null
          id?: string
          refresh_token?: string | null
          roles?: Json | null
          server_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_discord_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrations_discord_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations_twitch: {
        Row: {
          access_token: string | null
          broadcaster_type: string | null
          created_at: string
          description: string | null
          email: string | null
          id: string
          profile_image_url: string | null
          refresh_token: string | null
          token_expires_at: string | null
          twitch_user_id: string
          twitch_username: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          broadcaster_type?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id: string
          profile_image_url?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          twitch_user_id: string
          twitch_username: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          broadcaster_type?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          profile_image_url?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          twitch_user_id?: string
          twitch_username?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_twitch_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrations_twitch_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      overlays: {
        Row: {
          created_at: string
          elements: string | null
          height: number
          id: string
          name: string
          selectedElement: string | null
          user_id: string
          width: number
        }
        Insert: {
          created_at?: string
          elements?: string | null
          height: number
          id?: string
          name: string
          selectedElement?: string | null
          user_id: string
          width: number
        }
        Update: {
          created_at?: string
          elements?: string | null
          height?: number
          id?: string
          name?: string
          selectedElement?: string | null
          user_id?: string
          width?: number
        }
        Relationships: []
      }
      twitch_clip_syncs: {
        Row: {
          clip_count: number
          created_at: string | null
          id: number
          last_sync: string
          sync_status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          clip_count: number
          created_at?: string | null
          id?: number
          last_sync: string
          sync_status: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          clip_count?: number
          created_at?: string | null
          id?: number
          last_sync?: string
          sync_status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string | null
          id: string
          sync_clips_on_end: boolean
          theme: Database["public"]["Enums"]["theme_type"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          sync_clips_on_end?: boolean
          theme?: Database["public"]["Enums"]["theme_type"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          sync_clips_on_end?: boolean
          theme?: Database["public"]["Enums"]["theme_type"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          name: string
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          name: string
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      whitelist: {
        Row: {
          email: string
          id: number
          whitelisted: boolean
        }
        Insert: {
          email: string
          id?: number
          whitelisted?: boolean
        }
        Update: {
          email?: string
          id?: number
          whitelisted?: boolean
        }
        Relationships: []
      }
      workflow_triggers: {
        Row: {
          created_at: string
          event_id: string | null
          event_type: string | null
          id: string
          user_id: string
          workflow: string
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          event_type?: string | null
          id?: string
          user_id: string
          workflow: string
        }
        Update: {
          created_at?: string
          event_id?: string | null
          event_type?: string | null
          id?: string
          user_id?: string
          workflow?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_triggers_workflow_fkey"
            columns: ["workflow"]
            isOneToOne: false
            referencedRelation: "workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          broadcaster_id: string | null
          created_at: string | null
          cronpath: string | null
          description: string
          edges: string | null
          id: string
          name: string
          nodes: string | null
          publish: boolean | null
          user_id: string | null
        }
        Insert: {
          broadcaster_id?: string | null
          created_at?: string | null
          cronpath?: string | null
          description: string
          edges?: string | null
          id?: string
          name: string
          nodes?: string | null
          publish?: boolean | null
          user_id?: string | null
        }
        Update: {
          broadcaster_id?: string | null
          created_at?: string | null
          cronpath?: string | null
          description?: string
          edges?: string | null
          id?: string
          name?: string
          nodes?: string | null
          publish?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_clip_to_folder: {
        Args: {
          p_clip_id: string
          p_folder_id: string
        }
        Returns: undefined
      }
      get_all_clips_with_folders: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: number
          title: string
          twitch_clip_id: string
          creator_name: string
          game_name: string
          url: string
          thumbnail_url: string
          created_at: string
          view_count: number
          duration: number
          broadcaster_name: string
          created_at_twitch: string
          user_id: string
          embed_url: string
          broadcaster_id: string
          creator_id: string
          video_id: string
          game_id: string
          language: string
          vod_offset: number
          is_featured: boolean
          folders: Json
        }[]
      }
      get_clips_by_folder: {
        Args: {
          folder_href: string
        }
        Returns: {
          id: number
          title: string
          twitch_clip_id: string
          creator_name: string
          game_name: string
          url: string
          thumbnail_url: string
          created_at: string
          view_count: number
          duration: number
          broadcaster_name: string
          created_at_twitch: string
          user_id: string
          embed_url: string
          broadcaster_id: string
          creator_id: string
          video_id: string
          game_id: string
          language: string
          vod_offset: number
          is_featured: boolean
          folders: Json
        }[]
      }
      insert_discord_integration: {
        Args: {
          integration_id: string
          provider_data: Json
          user_id: string
        }
        Returns: undefined
      }
      insert_integration: {
        Args: {
          p_user_id: string
          p_provider_type: Database["public"]["Enums"]["provider_type"]
        }
        Returns: string
      }
      insert_twitch_integration: {
        Args: {
          integration_id: string
          provider_data: Json
          user_id: string
        }
        Returns: undefined
      }
      remove_clip_from_folder: {
        Args: {
          p_clip_id: string
          p_folder_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      actions:
        | "spotify.song_request"
        | "spotify.add_banned_song"
        | "spotify.remove_banned_song"
        | "spotify.add_banned_chatter"
        | "spotify.remove_banned_chatter"
        | "spotify.skip"
        | "none"
      provider_type: "twitch" | "discord"
      roles: "user" | "beta" | "admin"
      theme_type: "dark" | "light" | "system"
      userlevel:
        | "everyone"
        | "follower"
        | "vip"
        | "subscriber"
        | "moderator"
        | "super_moderator"
        | "broadcaster"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
