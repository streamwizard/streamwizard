export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  pgbouncer: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_auth: {
        Args: { p_usename: string }
        Returns: {
          password: string
          username: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      account_deletion_feedback: {
        Row: {
          additional_comments: string | null
          created_at: string
          id: string
          reason: Database["public"]["Enums"]["deletion_reason"]
        }
        Insert: {
          additional_comments?: string | null
          created_at?: string
          id?: string
          reason: Database["public"]["Enums"]["deletion_reason"]
        }
        Update: {
          additional_comments?: string | null
          created_at?: string
          id?: string
          reason?: Database["public"]["Enums"]["deletion_reason"]
        }
        Relationships: []
      }
      broadcaster_live_status: {
        Row: {
          broadcaster_id: string
          broadcaster_name: string
          category_id: string | null
          category_name: string | null
          created_at: string
          id: string
          is_live: boolean
          stream_ended_at: string | null
          stream_id: string | null
          stream_started_at: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          broadcaster_id: string
          broadcaster_name: string
          category_id?: string | null
          category_name?: string | null
          created_at?: string
          id?: string
          is_live?: boolean
          stream_ended_at?: string | null
          stream_id?: string | null
          stream_started_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          broadcaster_id?: string
          broadcaster_name?: string
          category_id?: string | null
          category_name?: string | null
          created_at?: string
          id?: string
          is_live?: boolean
          stream_ended_at?: string | null
          stream_id?: string | null
          stream_started_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcaster_live_status_broadcaster_id_fkey"
            columns: ["broadcaster_id"]
            referencedRelation: "integrations_twitch"
            referencedColumns: ["twitch_user_id"]
          },
        ]
      }
      clip_folder_junction: {
        Row: {
          clip_id: string
          created_at: string | null
          folder_id: number | null
          id: number
          user_id: string | null
        }
        Insert: {
          clip_id: string
          created_at?: string | null
          folder_id?: number | null
          id?: number
          user_id?: string | null
        }
        Update: {
          clip_id?: string
          created_at?: string | null
          folder_id?: number | null
          id?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clip_folder_junction_folder_id_fkey"
            columns: ["folder_id"]
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
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clips_video_id_fkey"
            columns: ["video_id"]
            referencedRelation: "vods"
            referencedColumns: ["video_id"]
          },
        ]
      }
      commands: {
        Row: {
          channel_id: string
          created_at: string
          custom_command_id: string | null
          default_command_id: string | null
          enabled: boolean
          id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          custom_command_id?: string | null
          default_command_id?: string | null
          enabled?: boolean
          id?: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          custom_command_id?: string | null
          default_command_id?: string | null
          enabled?: boolean
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commands_channel_id_fkey"
            columns: ["channel_id"]
            referencedRelation: "integrations_twitch"
            referencedColumns: ["twitch_user_id"]
          },
          {
            foreignKeyName: "commands_custom_command_id_fkey"
            columns: ["custom_command_id"]
            referencedRelation: "custom_commands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commands_default_command_id_fkey"
            columns: ["default_command_id"]
            referencedRelation: "default_chat_commands"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_commands: {
        Row: {
          action: string | null
          command: string
          context: Json | null
          created_at: string
          id: string
          message: string | null
        }
        Insert: {
          action?: string | null
          command: string
          context?: Json | null
          created_at?: string
          id?: string
          message?: string | null
        }
        Update: {
          action?: string | null
          command?: string
          context?: Json | null
          created_at?: string
          id?: string
          message?: string | null
        }
        Relationships: []
      }
      default_chat_commands: {
        Row: {
          action: string | null
          command: string
          context: Json | null
          created_at: string
          id: string
          message: string
        }
        Insert: {
          action?: string | null
          command: string
          context?: Json | null
          created_at?: string
          id?: string
          message: string
        }
        Update: {
          action?: string | null
          command?: string
          context?: Json | null
          created_at?: string
          id?: string
          message?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          category: Database["public"]["Enums"]["feedback_category"]
          created_at: string
          description: string
          discord: string | null
          id: string
          priority: Database["public"]["Enums"]["feedback_priority"]
          status: Database["public"]["Enums"]["feedback_status"]
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["feedback_category"]
          created_at?: string
          description: string
          discord?: string | null
          id?: string
          priority: Database["public"]["Enums"]["feedback_priority"]
          status?: Database["public"]["Enums"]["feedback_status"]
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["feedback_category"]
          created_at?: string
          description?: string
          discord?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["feedback_priority"]
          status?: Database["public"]["Enums"]["feedback_status"]
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
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
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations_twitch: {
        Row: {
          access_token_ciphertext: string | null
          access_token_iv: string | null
          access_token_tag: string | null
          broadcaster_type: string | null
          created_at: string
          description: string | null
          email: string | null
          id: string
          profile_image_url: string | null
          refresh_token_ciphertext: string | null
          refresh_token_iv: string | null
          refresh_token_tag: string | null
          token_expires_at: string | null
          twitch_user_id: string
          twitch_username: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_ciphertext?: string | null
          access_token_iv?: string | null
          access_token_tag?: string | null
          broadcaster_type?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id: string
          profile_image_url?: string | null
          refresh_token_ciphertext?: string | null
          refresh_token_iv?: string | null
          refresh_token_tag?: string | null
          token_expires_at?: string | null
          twitch_user_id: string
          twitch_username: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_ciphertext?: string | null
          access_token_iv?: string | null
          access_token_tag?: string | null
          broadcaster_type?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          profile_image_url?: string | null
          refresh_token_ciphertext?: string | null
          refresh_token_iv?: string | null
          refresh_token_tag?: string | null
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
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrations_twitch_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      irl_collector_tokens: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_used_at: string | null
          name: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      irl_geo_track: {
        Row: {
          accuracy: number | null
          altitude: number | null
          heading: number | null
          id: string
          inserted_at: string
          latitude: number
          longitude: number
          recorded_at: string
          session_id: string
          speed: number | null
          stream_id: string | null
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          altitude?: number | null
          heading?: number | null
          id?: string
          inserted_at?: string
          latitude: number
          longitude: number
          recorded_at: string
          session_id: string
          speed?: number | null
          stream_id?: string | null
          user_id: string
        }
        Update: {
          accuracy?: number | null
          altitude?: number | null
          heading?: number | null
          id?: string
          inserted_at?: string
          latitude?: number
          longitude?: number
          recorded_at?: string
          session_id?: string
          speed?: number | null
          stream_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "irl_geo_track_stream_id_fkey"
            columns: ["stream_id"]
            referencedRelation: "vods"
            referencedColumns: ["stream_id"]
          },
        ]
      }
      overlay_items: {
        Row: {
          config: Json
          created_at: string
          h: number
          id: string
          is_locked: boolean
          is_visible: boolean
          label: string
          opacity: number
          rotation: number
          scene_id: string
          type: string
          updated_at: string
          w: number
          x: number
          y: number
          z_index: number
        }
        Insert: {
          config?: Json
          created_at?: string
          h?: number
          id?: string
          is_locked?: boolean
          is_visible?: boolean
          label?: string
          opacity?: number
          rotation?: number
          scene_id: string
          type?: string
          updated_at?: string
          w?: number
          x?: number
          y?: number
          z_index?: number
        }
        Update: {
          config?: Json
          created_at?: string
          h?: number
          id?: string
          is_locked?: boolean
          is_visible?: boolean
          label?: string
          opacity?: number
          rotation?: number
          scene_id?: string
          type?: string
          updated_at?: string
          w?: number
          x?: number
          y?: number
          z_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "overlay_items_scene_id_fkey"
            columns: ["scene_id"]
            referencedRelation: "overlay_scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      overlay_scenes: {
        Row: {
          created_at: string
          height: number
          id: string
          is_active: boolean
          name: string
          render_mode: string
          slug: string
          subscriber_token: string
          updated_at: string
          user_id: string
          width: number
        }
        Insert: {
          created_at?: string
          height?: number
          id?: string
          is_active?: boolean
          name: string
          render_mode?: string
          slug: string
          subscriber_token?: string
          updated_at?: string
          user_id: string
          width?: number
        }
        Update: {
          created_at?: string
          height?: number
          id?: string
          is_active?: boolean
          name?: string
          render_mode?: string
          slug?: string
          subscriber_token?: string
          updated_at?: string
          user_id?: string
          width?: number
        }
        Relationships: []
      }
      overlay_widget_instances: {
        Row: {
          created_at: string
          field_values: Json
          id: string
          overlay_item_id: string
          updated_at: string
          user_id: string
          widget_id: string
          widget_state: Json
        }
        Insert: {
          created_at?: string
          field_values?: Json
          id?: string
          overlay_item_id: string
          updated_at?: string
          user_id: string
          widget_id: string
          widget_state?: Json
        }
        Update: {
          created_at?: string
          field_values?: Json
          id?: string
          overlay_item_id?: string
          updated_at?: string
          user_id?: string
          widget_id?: string
          widget_state?: Json
        }
        Relationships: [
          {
            foreignKeyName: "overlay_widget_instances_overlay_item_id_fkey"
            columns: ["overlay_item_id"]
            referencedRelation: "overlay_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overlay_widget_instances_widget_id_fkey"
            columns: ["widget_id"]
            referencedRelation: "widgets"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_clips: {
        Row: {
          broadcaster_id: string
          clip_id: string
          created_at: string
          error_message: string | null
          id: string
          last_checked_at: string | null
          max_retries: number
          next_retry_at: string
          retry_count: number
          status: string
        }
        Insert: {
          broadcaster_id: string
          clip_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          last_checked_at?: string | null
          max_retries?: number
          next_retry_at?: string
          retry_count?: number
          status?: string
        }
        Update: {
          broadcaster_id?: string
          clip_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          last_checked_at?: string | null
          max_retries?: number
          next_retry_at?: string
          retry_count?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_clips_broadcaster_id_fkey"
            columns: ["broadcaster_id"]
            referencedRelation: "integrations_twitch"
            referencedColumns: ["twitch_user_id"]
          },
        ]
      }
      smp_actions: {
        Row: {
          action: string
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          name: string
          trigger: string | null
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          name: string
          trigger?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          trigger?: string | null
        }
        Relationships: []
      }
      smp_channelpoints_templates: {
        Row: {
          action: string | null
          background_color: string | null
          cost: number
          created_at: string
          global_cooldown_seconds: number | null
          id: string
          is_enabled: boolean | null
          is_global_cooldown_enabled: boolean | null
          is_max_per_stream_enabled: boolean | null
          is_max_per_user_per_stream_enabled: boolean | null
          is_user_input_required: boolean | null
          max_per_stream: number | null
          max_per_user_per_stream: number | null
          prompt: string | null
          should_redemptions_skip_request_queue: boolean | null
          title: string
        }
        Insert: {
          action?: string | null
          background_color?: string | null
          cost: number
          created_at?: string
          global_cooldown_seconds?: number | null
          id?: string
          is_enabled?: boolean | null
          is_global_cooldown_enabled?: boolean | null
          is_max_per_stream_enabled?: boolean | null
          is_max_per_user_per_stream_enabled?: boolean | null
          is_user_input_required?: boolean | null
          max_per_stream?: number | null
          max_per_user_per_stream?: number | null
          prompt?: string | null
          should_redemptions_skip_request_queue?: boolean | null
          title: string
        }
        Update: {
          action?: string | null
          background_color?: string | null
          cost?: number
          created_at?: string
          global_cooldown_seconds?: number | null
          id?: string
          is_enabled?: boolean | null
          is_global_cooldown_enabled?: boolean | null
          is_max_per_stream_enabled?: boolean | null
          is_max_per_user_per_stream_enabled?: boolean | null
          is_user_input_required?: boolean | null
          max_per_stream?: number | null
          max_per_user_per_stream?: number | null
          prompt?: string | null
          should_redemptions_skip_request_queue?: boolean | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "smp_channelpoints_templates_action_fkey"
            columns: ["action"]
            referencedRelation: "smp_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      smp_players: {
        Row: {
          broadcaster_id: string | null
          created_at: string
          id: string
          is_online: boolean
          minecraft_player_uuid: string | null
          user_id: string
        }
        Insert: {
          broadcaster_id?: string | null
          created_at?: string
          id?: string
          is_online?: boolean
          minecraft_player_uuid?: string | null
          user_id?: string
        }
        Update: {
          broadcaster_id?: string | null
          created_at?: string
          id?: string
          is_online?: boolean
          minecraft_player_uuid?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "smp_players_broadcaster_id_fkey"
            columns: ["broadcaster_id"]
            referencedRelation: "integrations_twitch"
            referencedColumns: ["twitch_user_id"]
          },
          {
            foreignKeyName: "smp_players_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      smp_triggers: {
        Row: {
          action_id: string | null
          conditions: Json
          created_at: string
          event_type: string
          id: string
        }
        Insert: {
          action_id?: string | null
          conditions?: Json
          created_at?: string
          event_type: string
          id?: string
        }
        Update: {
          action_id?: string | null
          conditions?: Json
          created_at?: string
          event_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "smp_triggers_action_id_fkey"
            columns: ["action_id"]
            referencedRelation: "smp_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      stream_events: {
        Row: {
          broadcaster_id: string
          created_at: string
          event_data: Json
          event_type: string
          id: string
          metadata: Json | null
          offset_seconds: number
          provider: string
          status: string
          stream_id: string
          updated_at: string
        }
        Insert: {
          broadcaster_id: string
          created_at?: string
          event_data?: Json
          event_type: string
          id?: string
          metadata?: Json | null
          offset_seconds?: number
          provider: string
          status?: string
          stream_id: string
          updated_at?: string
        }
        Update: {
          broadcaster_id?: string
          created_at?: string
          event_data?: Json
          event_type?: string
          id?: string
          metadata?: Json | null
          offset_seconds?: number
          provider?: string
          status?: string
          stream_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stream_events_broadcaster_id_fkey"
            columns: ["broadcaster_id"]
            referencedRelation: "integrations_twitch"
            referencedColumns: ["twitch_user_id"]
          },
          {
            foreignKeyName: "stream_events_stream_id_fkey"
            columns: ["stream_id"]
            referencedRelation: "vods"
            referencedColumns: ["stream_id"]
          },
        ]
      }
      stream_viewer_counts: {
        Row: {
          broadcaster_id: string
          created_at: string
          game_id: string | null
          game_name: string | null
          id: string
          offset_seconds: number
          recorded_at: string
          stream_id: string
          title: string | null
          viewer_count: number
        }
        Insert: {
          broadcaster_id: string
          created_at?: string
          game_id?: string | null
          game_name?: string | null
          id?: string
          offset_seconds: number
          recorded_at?: string
          stream_id: string
          title?: string | null
          viewer_count: number
        }
        Update: {
          broadcaster_id?: string
          created_at?: string
          game_id?: string | null
          game_name?: string | null
          id?: string
          offset_seconds?: number
          recorded_at?: string
          stream_id?: string
          title?: string | null
          viewer_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_broadcaster"
            columns: ["broadcaster_id"]
            referencedRelation: "integrations_twitch"
            referencedColumns: ["twitch_user_id"]
          },
          {
            foreignKeyName: "stream_viewer_counts_stream_id_fkey"
            columns: ["stream_id"]
            referencedRelation: "vods"
            referencedColumns: ["stream_id"]
          },
        ]
      }
      system_events: {
        Row: {
          broadcaster_id: string | null
          created_at: string
          error_message: string | null
          event_data: Json
          event_type: string
          id: string
          metadata: Json | null
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          broadcaster_id?: string | null
          created_at?: string
          error_message?: string | null
          event_data?: Json
          event_type: string
          id?: string
          metadata?: Json | null
          provider: string
          status?: string
          updated_at?: string
        }
        Update: {
          broadcaster_id?: string | null
          created_at?: string
          error_message?: string | null
          event_data?: Json
          event_type?: string
          id?: string
          metadata?: Json | null
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          active: boolean
          content: string
          created_at: string
          href: string
          id: string
          profile_img: string
          user_id: string | null
          username: string
        }
        Insert: {
          active?: boolean
          content: string
          created_at?: string
          href: string
          id?: string
          profile_img: string
          user_id?: string | null
          username: string
        }
        Update: {
          active?: boolean
          content?: string
          created_at?: string
          href?: string
          id?: string
          profile_img?: string
          user_id?: string | null
          username?: string
        }
        Relationships: []
      }
      twitch_app_token: {
        Row: {
          access_token_ciphertext: string | null
          access_token_iv: string | null
          access_token_tag: string | null
          created_at: string
          expires_in: number
          id: string
          singleton: string
          updated_at: string
        }
        Insert: {
          access_token_ciphertext?: string | null
          access_token_iv?: string | null
          access_token_tag?: string | null
          created_at?: string
          expires_in: number
          id?: string
          singleton?: string
          updated_at?: string
        }
        Update: {
          access_token_ciphertext?: string | null
          access_token_iv?: string | null
          access_token_tag?: string | null
          created_at?: string
          expires_in?: number
          id?: string
          singleton?: string
          updated_at?: string
        }
        Relationships: []
      }
      twitch_clip_syncs: {
        Row: {
          clip_count: number
          created_at: string | null
          id: number
          last_sync: string
          sync_status: Database["public"]["Enums"]["clip_sync_status"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          clip_count: number
          created_at?: string | null
          id?: number
          last_sync: string
          sync_status: Database["public"]["Enums"]["clip_sync_status"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          clip_count?: number
          created_at?: string | null
          id?: number
          last_sync?: string
          sync_status?: Database["public"]["Enums"]["clip_sync_status"]
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
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
      vods: {
        Row: {
          broadcaster_id: string
          created_at: string
          id: string
          started_at: string | null
          stream_id: string | null
          video_id: string
        }
        Insert: {
          broadcaster_id: string
          created_at?: string
          id?: string
          started_at?: string | null
          stream_id?: string | null
          video_id: string
        }
        Update: {
          broadcaster_id?: string
          created_at?: string
          id?: string
          started_at?: string | null
          stream_id?: string | null
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vods_broadcaster_id_fkey"
            columns: ["broadcaster_id"]
            referencedRelation: "integrations_twitch"
            referencedColumns: ["twitch_user_id"]
          },
        ]
      }
      widget_library_entries: {
        Row: {
          created_at: string
          description: string
          id: string
          installs: number
          is_approved: boolean
          likes: number
          tags: string[]
          title: string
          user_id: string
          widget_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          installs?: number
          is_approved?: boolean
          likes?: number
          tags?: string[]
          title: string
          user_id: string
          widget_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          installs?: number
          is_approved?: boolean
          likes?: number
          tags?: string[]
          title?: string
          user_id?: string
          widget_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "widget_library_entries_widget_id_fkey"
            columns: ["widget_id"]
            referencedRelation: "widgets"
            referencedColumns: ["id"]
          },
        ]
      }
      widgets: {
        Row: {
          created_at: string
          description: string
          extra_css: string
          fields: Json
          html: string
          id: string
          js: string
          name: string
          preview_url: string | null
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          extra_css?: string
          fields?: Json
          html?: string
          id?: string
          js?: string
          name: string
          preview_url?: string | null
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          extra_css?: string
          fields?: Json
          html?: string
          id?: string
          js?: string
          name?: string
          preview_url?: string | null
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_clip_to_folder: {
        Args: { p_clip_id: string; p_folder_id: string }
        Returns: undefined
      }
      check_user_role: {
        Args: { p_role: string; p_user_id: string }
        Returns: boolean
      }
      delete_user_data: { Args: { p_twitch_user_id: string }; Returns: string }
      get_all_clips_with_folders: {
        Args: never
        Returns: {
          broadcaster_id: string
          broadcaster_name: string
          created_at: string
          created_at_twitch: string
          creator_id: string
          creator_name: string
          duration: number
          embed_url: string
          folders: Json
          game_id: string
          game_name: string
          id: number
          is_featured: boolean
          language: string
          thumbnail_url: string
          title: string
          twitch_clip_id: string
          url: string
          user_id: string
          video_id: string
          view_count: number
          vod_offset: number
        }[]
      }
      get_clips_by_folder: {
        Args: { folder_href: string }
        Returns: {
          broadcaster_id: string
          broadcaster_name: string
          created_at: string
          created_at_twitch: string
          creator_id: string
          creator_name: string
          duration: number
          embed_url: string
          folders: Json
          game_id: string
          game_name: string
          id: number
          is_featured: boolean
          language: string
          thumbnail_url: string
          title: string
          twitch_clip_id: string
          url: string
          user_id: string
          video_id: string
          view_count: number
          vod_offset: number
        }[]
      }
      get_stream_data: { Args: { p_video_id: string }; Returns: Json }
      get_user_twitch_ids: { Args: never; Returns: string[] }
      increment_widget_installs: {
        Args: { entry_id: string }
        Returns: undefined
      }
      insert_discord_integration: {
        Args: { integration_id: string; provider_data: Json; user_id: string }
        Returns: undefined
      }
      insert_integration: {
        Args: {
          p_provider_type: Database["public"]["Enums"]["provider_type"]
          p_user_id: string
        }
        Returns: string
      }
      insert_twitch_integration: {
        Args: { integration_id: string; provider_data: Json; user_id: string }
        Returns: undefined
      }
      jwt_broadcaster_id: { Args: never; Returns: string }
      remove_clip_from_folder: {
        Args: { p_clip_id: string; p_folder_id: string }
        Returns: undefined
      }
      sync_all_default_commands: {
        Args: never
        Returns: {
          total_channels: number
          total_commands_added: number
        }[]
      }
      sync_default_commands_for_channels: {
        Args: { target_channel_id?: string }
        Returns: {
          commands_added: number
          returned_channel_id: string
        }[]
      }
      user_owns_channel: { Args: { channel_id: string }; Returns: boolean }
    }
    Enums: {
      clip_sync_status: "completed" | "failed" | "syncing"
      deletion_reason:
        | "too_expensive"
        | "missing_features"
        | "switching_to_another_tool"
        | "just_taking_a_break"
      feedback_category: "bug" | "feature" | "general"
      feedback_priority: "low" | "medium" | "high" | "critical"
      feedback_status: "open" | "in_progress" | "resolved" | "closed"
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
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      iceberg_namespaces: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_namespaces_catalog_id_fkey"
            columns: ["catalog_id"]
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      iceberg_tables: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          location: string
          name: string
          namespace_id: string
          remote_table_id: string | null
          shard_id: string | null
          shard_key: string | null
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          location: string
          name: string
          namespace_id: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          namespace_id?: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_tables_catalog_id_fkey"
            columns: ["catalog_id"]
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iceberg_tables_namespace_id_fkey"
            columns: ["namespace_id"]
            referencedRelation: "iceberg_namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          metadata: Json | null
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      clip_sync_status: ["completed", "failed", "syncing"],
      deletion_reason: [
        "too_expensive",
        "missing_features",
        "switching_to_another_tool",
        "just_taking_a_break",
      ],
      feedback_category: ["bug", "feature", "general"],
      feedback_priority: ["low", "medium", "high", "critical"],
      feedback_status: ["open", "in_progress", "resolved", "closed"],
      provider_type: ["twitch", "discord"],
      roles: ["user", "beta", "admin"],
      theme_type: ["dark", "light", "system"],
      userlevel: [
        "everyone",
        "follower",
        "vip",
        "subscriber",
        "moderator",
        "super_moderator",
        "broadcaster",
      ],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const

