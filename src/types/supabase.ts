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
      commands: {
        Row: {
          action: string | null
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
          userlevel: Database["public"]["Enums"]["userlevel"]
        }
        Insert: {
          action?: string | null
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
          userlevel?: Database["public"]["Enums"]["userlevel"]
        }
        Update: {
          action?: string | null
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
          userlevel?: Database["public"]["Enums"]["userlevel"]
        }
        Relationships: [
          {
            foreignKeyName: "commands_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "twitch_integration"
            referencedColumns: ["user_id"]
          },
        ]
      }
      spotify_banned_chatters: {
        Row: {
          broadcaster_id: string
          broadcaster_name: string
          chatter_id: string
          chatter_name: string
          created_at: string
          id: string
          moderator_id: string | null
          moderator_name: string | null
          settings_id: string
          user_id: string | null
        }
        Insert: {
          broadcaster_id: string
          broadcaster_name: string
          chatter_id: string
          chatter_name: string
          created_at?: string
          id?: string
          moderator_id?: string | null
          moderator_name?: string | null
          settings_id: string
          user_id?: string | null
        }
        Update: {
          broadcaster_id?: string
          broadcaster_name?: string
          chatter_id?: string
          chatter_name?: string
          created_at?: string
          id?: string
          moderator_id?: string | null
          moderator_name?: string | null
          settings_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spotify_banned_chatters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "spotify_settings"
            referencedColumns: ["user_id"]
          },
        ]
      }
      spotify_banned_songs: {
        Row: {
          artists: string
          broadcaster_id: string
          broadcaster_name: string
          created_at: string | null
          id: string
          settings_id: string
          song_id: string
          song_name: string
          user_id: string | null
        }
        Insert: {
          artists: string
          broadcaster_id: string
          broadcaster_name: string
          created_at?: string | null
          id?: string
          settings_id: string
          song_id: string
          song_name: string
          user_id?: string | null
        }
        Update: {
          artists?: string
          broadcaster_id?: string
          broadcaster_name?: string
          created_at?: string | null
          id?: string
          settings_id?: string
          song_id?: string
          song_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spotify_banned_songs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "spotify_settings"
            referencedColumns: ["user_id"]
          },
        ]
      }
      spotify_integrations: {
        Row: {
          access_token: string
          account: string
          created_at: string
          email: string
          id: string
          refresh_token: string
          spotify_id: string
          user_id: string
        }
        Insert: {
          access_token: string
          account: string
          created_at?: string
          email: string
          id?: string
          refresh_token: string
          spotify_id: string
          user_id: string
        }
        Update: {
          access_token?: string
          account?: string
          created_at?: string
          email?: string
          id?: string
          refresh_token?: string
          spotify_id?: string
          user_id?: string
        }
        Relationships: []
      }
      spotify_queue: {
        Row: {
          artists: string
          broadcaster_id: string
          broadcaster_name: string
          chatter_id: string
          chatter_name: string
          created_at: string
          id: number
          song_id: string
          song_name: string
          user_id: string
        }
        Insert: {
          artists: string
          broadcaster_id: string
          broadcaster_name: string
          chatter_id: string
          chatter_name: string
          created_at?: string
          id?: number
          song_id: string
          song_name: string
          user_id: string
        }
        Update: {
          artists?: string
          broadcaster_id?: string
          broadcaster_name?: string
          chatter_id?: string
          chatter_name?: string
          created_at?: string
          id?: number
          song_id?: string
          song_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spotify_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "spotify_settings"
            referencedColumns: ["user_id"]
          },
        ]
      }
      spotify_settings: {
        Row: {
          chatter_queue_limit: number
          created_at: string
          global_queue_limit: number
          id: string
          live_only: boolean
          user_id: string
        }
        Insert: {
          chatter_queue_limit?: number
          created_at?: string
          global_queue_limit?: number
          id?: string
          live_only?: boolean
          user_id: string
        }
        Update: {
          chatter_queue_limit?: number
          created_at?: string
          global_queue_limit?: number
          id?: string
          live_only?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spotify_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "spotify_integrations"
            referencedColumns: ["user_id"]
          },
        ]
      }
      twitch_channelpoints: {
        Row: {
          action: string | null
          broadcaster_id: string
          channelpoint_id: string
          id: number
          user_id: string
        }
        Insert: {
          action?: string | null
          broadcaster_id: string
          channelpoint_id: string
          id?: number
          user_id: string
        }
        Update: {
          action?: string | null
          broadcaster_id?: string
          channelpoint_id?: string
          id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "twitch_channelpoints_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "twitch_integration"
            referencedColumns: ["user_id"]
          },
        ]
      }
      twitch_integration: {
        Row: {
          access_token: string
          account: string
          broadcaster_id: string
          id: string
          refresh_token: string
          user_id: string
        }
        Insert: {
          access_token: string
          account: string
          broadcaster_id: string
          id?: string
          refresh_token: string
          user_id: string
        }
        Update: {
          access_token?: string
          account?: string
          broadcaster_id?: string
          id?: string
          refresh_token?: string
          user_id?: string
        }
        Relationships: []
      }
      user_integrations: {
        Row: {
          created_at: string
          id: string
          spotify: string | null
          twitch: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          spotify?: string | null
          twitch?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          spotify?: string | null
          twitch?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_integrations_spotify_fkey"
            columns: ["spotify"]
            isOneToOne: true
            referencedRelation: "spotify_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_integrations_twitch_fkey"
            columns: ["twitch"]
            isOneToOne: true
            referencedRelation: "twitch_integration"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_integrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          email: string | null
          id: string
          image: string | null
          name: string | null
        }
        Insert: {
          email?: string | null
          id: string
          image?: string | null
          name?: string | null
        }
        Update: {
          email?: string | null
          id?: string
          image?: string | null
          name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      twitch_integration: {
        Args: {
          new_record: Record<string, unknown>
        }
        Returns: string
      }
    }
    Enums: {
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
