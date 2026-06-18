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
      _clip_uuid_migration_backup_folders: {
        Row: {
          created_at: string | null
          href: string | null
          id: number | null
          name: string | null
          parent_folder_id: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          href?: string | null
          id?: number | null
          name?: string | null
          parent_folder_id?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          href?: string | null
          id?: number | null
          name?: string | null
          parent_folder_id?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      _clip_uuid_migration_backup_junction: {
        Row: {
          clip_id: string | null
          created_at: string | null
          folder_id: number | null
          id: number | null
          user_id: string | null
        }
        Insert: {
          clip_id?: string | null
          created_at?: string | null
          folder_id?: number | null
          id?: number | null
          user_id?: string | null
        }
        Update: {
          clip_id?: string | null
          created_at?: string | null
          folder_id?: number | null
          id?: number | null
          user_id?: string | null
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
            isOneToOne: true
            referencedRelation: "integrations_twitch"
            referencedColumns: ["twitch_user_id"]
          },
        ]
      }
      clip_folder_junction: {
        Row: {
          clip_id: string
          created_at: string | null
          folder_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          clip_id: string
          created_at?: string | null
          folder_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          clip_id?: string
          created_at?: string | null
          folder_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
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
          id: string
          name: string
          parent_folder_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          href: string
          id?: string
          name: string
          parent_folder_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          href?: string
          id?: string
          name?: string
          parent_folder_id?: string | null
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
          id: string
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
          id?: string
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
          id?: string
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
          {
            foreignKeyName: "clips_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
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
            isOneToOne: false
            referencedRelation: "integrations_twitch"
            referencedColumns: ["twitch_user_id"]
          },
          {
            foreignKeyName: "commands_custom_command_id_fkey"
            columns: ["custom_command_id"]
            isOneToOne: false
            referencedRelation: "custom_commands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commands_default_command_id_fkey"
            columns: ["default_command_id"]
            isOneToOne: false
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
      discord_command_permissions: {
        Row: {
          command_name: string
          created_at: string
          guild_id: string
          id: string
          role_id: string
        }
        Insert: {
          command_name: string
          created_at?: string
          guild_id: string
          id?: string
          role_id: string
        }
        Update: {
          command_name?: string
          created_at?: string
          guild_id?: string
          id?: string
          role_id?: string
        }
        Relationships: []
      }
      discord_guild_members: {
        Row: {
          guild_id: string
          id: string
          join_number: number
          joined_at: string
          user_id: string
        }
        Insert: {
          guild_id: string
          id?: string
          join_number: number
          joined_at?: string
          user_id: string
        }
        Update: {
          guild_id?: string
          id?: string
          join_number?: number
          joined_at?: string
          user_id?: string
        }
        Relationships: []
      }
      discord_guild_settings: {
        Row: {
          created_at: string
          guild_id: string
          id: string
          updated_at: string
          welcome_channel_id: string | null
          welcome_enabled: boolean
        }
        Insert: {
          created_at?: string
          guild_id: string
          id?: string
          updated_at?: string
          welcome_channel_id?: string | null
          welcome_enabled?: boolean
        }
        Update: {
          created_at?: string
          guild_id?: string
          id?: string
          updated_at?: string
          welcome_channel_id?: string | null
          welcome_enabled?: boolean
        }
        Relationships: []
      }
      discord_ticket_settings: {
        Row: {
          category_id: string | null
          created_at: string
          enabled: boolean
          guild_id: string
          id: string
          log_channel_id: string | null
          panel_channel_id: string | null
          panel_message_id: string | null
          staff_role_id: string | null
          ticket_counter: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          enabled?: boolean
          guild_id: string
          id?: string
          log_channel_id?: string | null
          panel_channel_id?: string | null
          panel_message_id?: string | null
          staff_role_id?: string | null
          ticket_counter?: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          enabled?: boolean
          guild_id?: string
          id?: string
          log_channel_id?: string | null
          panel_channel_id?: string | null
          panel_message_id?: string | null
          staff_role_id?: string | null
          ticket_counter?: number
          updated_at?: string
        }
        Relationships: []
      }
      discord_tickets: {
        Row: {
          category: Database["public"]["Enums"]["discord_ticket_category"]
          channel_id: string
          claimed_at: string | null
          claimed_by_discord_user_id: string | null
          closed_at: string | null
          closed_by_discord_user_id: string | null
          created_at: string
          description: string
          github_issue_number: number | null
          github_issue_url: string | null
          guild_id: string
          id: string
          opener_discord_user_id: string
          opener_user_id: string | null
          status: Database["public"]["Enums"]["discord_ticket_status"]
          subject: string
          ticket_number: number
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["discord_ticket_category"]
          channel_id: string
          claimed_at?: string | null
          claimed_by_discord_user_id?: string | null
          closed_at?: string | null
          closed_by_discord_user_id?: string | null
          created_at?: string
          description: string
          github_issue_number?: number | null
          github_issue_url?: string | null
          guild_id: string
          id?: string
          opener_discord_user_id: string
          opener_user_id?: string | null
          status?: Database["public"]["Enums"]["discord_ticket_status"]
          subject: string
          ticket_number: number
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["discord_ticket_category"]
          channel_id?: string
          claimed_at?: string | null
          claimed_by_discord_user_id?: string | null
          closed_at?: string | null
          closed_by_discord_user_id?: string | null
          created_at?: string
          description?: string
          github_issue_number?: number | null
          github_issue_url?: string | null
          guild_id?: string
          id?: string
          opener_discord_user_id?: string
          opener_user_id?: string | null
          status?: Database["public"]["Enums"]["discord_ticket_status"]
          subject?: string
          ticket_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "discord_tickets_opener_user_id_fkey"
            columns: ["opener_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
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
          access_token_ciphertext: string | null
          access_token_iv: string | null
          access_token_tag: string | null
          avatar: string | null
          created_at: string
          discord_user_id: string
          discord_username: string
          email: string | null
          id: string
          refresh_token_ciphertext: string | null
          refresh_token_iv: string | null
          refresh_token_tag: string | null
          roles: Json
          server_id: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_ciphertext?: string | null
          access_token_iv?: string | null
          access_token_tag?: string | null
          avatar?: string | null
          created_at?: string
          discord_user_id: string
          discord_username: string
          email?: string | null
          id?: string
          refresh_token_ciphertext?: string | null
          refresh_token_iv?: string | null
          refresh_token_tag?: string | null
          roles?: Json
          server_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_ciphertext?: string | null
          access_token_iv?: string | null
          access_token_tag?: string | null
          avatar?: string | null
          created_at?: string
          discord_user_id?: string
          discord_username?: string
          email?: string | null
          id?: string
          refresh_token_ciphertext?: string | null
          refresh_token_iv?: string | null
          refresh_token_tag?: string | null
          roles?: Json
          server_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_discord_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "integrations"
            referencedColumns: ["user_id"]
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
          id?: string
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
            foreignKeyName: "integrations_twitch_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "integrations"
            referencedColumns: ["user_id"]
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
            isOneToOne: false
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
            isOneToOne: false
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
            isOneToOne: false
            referencedRelation: "overlay_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "overlay_widget_instances_widget_id_fkey"
            columns: ["widget_id"]
            isOneToOne: false
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
            isOneToOne: false
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
            isOneToOne: false
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
            isOneToOne: false
            referencedRelation: "integrations_twitch"
            referencedColumns: ["twitch_user_id"]
          },
          {
            foreignKeyName: "smp_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
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
            isOneToOne: false
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
            isOneToOne: false
            referencedRelation: "integrations_twitch"
            referencedColumns: ["twitch_user_id"]
          },
          {
            foreignKeyName: "stream_events_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
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
            isOneToOne: false
            referencedRelation: "integrations_twitch"
            referencedColumns: ["twitch_user_id"]
          },
          {
            foreignKeyName: "stream_viewer_counts_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
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
          id: string
          last_sync: string
          sync_status: Database["public"]["Enums"]["clip_sync_status"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          clip_count: number
          created_at?: string | null
          id?: string
          last_sync: string
          sync_status: Database["public"]["Enums"]["clip_sync_status"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          clip_count?: number
          created_at?: string | null
          id?: string
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
          memes_enabled: boolean
          onboarding_completed: boolean
          show_stream_stats: boolean
          sync_clips_on_end: boolean
          theme: Database["public"]["Enums"]["theme_type"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          memes_enabled?: boolean
          onboarding_completed?: boolean
          show_stream_stats?: boolean
          sync_clips_on_end?: boolean
          theme?: Database["public"]["Enums"]["theme_type"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          memes_enabled?: boolean
          onboarding_completed?: boolean
          show_stream_stats?: boolean
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
            isOneToOne: false
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
            isOneToOne: false
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
            isOneToOne: false
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
      check_user_role:
        | { Args: { p_role: string }; Returns: boolean }
        | { Args: { p_role: string; p_user_id: string }; Returns: boolean }
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
          id: string
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
          id: string
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
        Args: { p_user_id: string; provider_data: Json }
        Returns: undefined
      }
      insert_integration: { Args: { p_user_id: string }; Returns: undefined }
      insert_twitch_integration: {
        Args: { p_user_id: string; provider_data: Json }
        Returns: undefined
      }
      jwt_broadcaster_id: { Args: never; Returns: string }
      link_discord_integration: {
        Args: {
          p_avatar: string
          p_discord_user_id: string
          p_discord_username: string
          p_email: string
        }
        Returns: undefined
      }
      next_ticket_number: { Args: { p_guild_id: string }; Returns: number }
      record_guild_member_join: {
        Args: { p_guild_id: string; p_member_count: number; p_user_id: string }
        Returns: number
      }
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
      discord_ticket_category: "bug" | "feature" | "support" | "other"
      discord_ticket_status: "open" | "closed"
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
      discord_ticket_category: ["bug", "feature", "support", "other"],
      discord_ticket_status: ["open", "closed"],
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
} as const

