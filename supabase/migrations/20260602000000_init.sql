

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE SCHEMA IF NOT EXISTS "analytics";

ALTER SCHEMA "analytics" OWNER TO "postgres";

CREATE EXTENSION IF NOT EXISTS "pgsodium";

COMMENT ON SCHEMA "public" IS 'standard public schema';

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

CREATE TYPE "public"."clip_sync_status" AS ENUM (
    'completed',
    'failed',
    'syncing'
);

ALTER TYPE "public"."clip_sync_status" OWNER TO "postgres";

CREATE TYPE "public"."feedback_category" AS ENUM (
    'bug',
    'feature',
    'general'
);

ALTER TYPE "public"."feedback_category" OWNER TO "postgres";

CREATE TYPE "public"."feedback_priority" AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);

ALTER TYPE "public"."feedback_priority" OWNER TO "postgres";

CREATE TYPE "public"."feedback_status" AS ENUM (
    'open',
    'in_progress',
    'resolved',
    'closed'
);

ALTER TYPE "public"."feedback_status" OWNER TO "postgres";

CREATE TYPE "public"."provider_type" AS ENUM (
    'twitch',
    'discord'
);

ALTER TYPE "public"."provider_type" OWNER TO "postgres";

CREATE TYPE "public"."roles" AS ENUM (
    'user',
    'beta',
    'admin'
);

ALTER TYPE "public"."roles" OWNER TO "postgres";

CREATE TYPE "public"."theme_type" AS ENUM (
    'dark',
    'light',
    'system'
);

ALTER TYPE "public"."theme_type" OWNER TO "postgres";

CREATE TYPE "public"."userlevel" AS ENUM (
    'everyone',
    'follower',
    'vip',
    'subscriber',
    'moderator',
    'super_moderator',
    'broadcaster'
);

ALTER TYPE "public"."userlevel" OWNER TO "postgres";

COMMENT ON TYPE "public"."userlevel" IS 'userlevel for the twitch commands';

CREATE OR REPLACE FUNCTION "public"."add_clip_to_folder"("p_clip_id" "uuid", "p_folder_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into clip_folder_junction (clip_id, folder_id, user_id)
  values (
    p_clip_id, 
    p_folder_id, 
    auth.uid()
  );
end;
$$;

ALTER FUNCTION "public"."add_clip_to_folder"("p_clip_id" "uuid", "p_folder_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."check_user_role"("p_user_id" "uuid", "p_role" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p_user_id
      AND ur.role = p_role
  );
$$;

ALTER FUNCTION "public"."check_user_role"("p_user_id" "uuid", "p_role" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_default_commands_for_channel"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$BEGIN
  -- Insert a command for each default chat command
  INSERT INTO public.commands (default_command_id, enabled, channel_id)
  SELECT 
    dcc.id,
    false,
    NEW.twitch_user_id
  FROM public.default_chat_commands dcc;
  
  RETURN NEW;
END;$$;

ALTER FUNCTION "public"."create_default_commands_for_channel"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_workflow_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$BEGIN
  INSERT INTO workflow_triggers (workflow, user_id)
  VALUES (NEW.id, NEW.user_id);
  RETURN NEW;
END;$$;

ALTER FUNCTION "public"."create_workflow_trigger"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."delete_user_data"("p_twitch_user_id" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.integrations_twitch
  WHERE twitch_user_id = p_twitch_user_id;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  DELETE FROM public.clip_folder_junction WHERE user_id = v_user_id;
  DELETE FROM public.pending_clips WHERE broadcaster_id = p_twitch_user_id;
  DELETE FROM public.twitch_clip_syncs WHERE user_id = v_user_id;
  DELETE FROM public.stream_events WHERE broadcaster_id = p_twitch_user_id;
  DELETE FROM public.stream_viewer_counts WHERE broadcaster_id = p_twitch_user_id;
  DELETE FROM public.broadcaster_live_status WHERE broadcaster_id = p_twitch_user_id;
  DELETE FROM public.overlay_widget_instances WHERE user_id = v_user_id;
  DELETE FROM public.overlay_items WHERE scene_id IN (
    SELECT id FROM public.overlay_scenes WHERE user_id = v_user_id
  );
  DELETE FROM public.overlay_scenes WHERE user_id = v_user_id;
  DELETE FROM public.widget_library_entries WHERE user_id = v_user_id;
  DELETE FROM public.widgets WHERE user_id = v_user_id;
  DELETE FROM public.commands WHERE channel_id = p_twitch_user_id;
  DELETE FROM public.smp_players WHERE user_id = v_user_id;
  DELETE FROM public.vods WHERE broadcaster_id = p_twitch_user_id;
  DELETE FROM public.clips WHERE user_id = v_user_id;
  DELETE FROM public.clip_folders WHERE user_id = v_user_id;
  DELETE FROM public.testimonials WHERE user_id = v_user_id;
  DELETE FROM public.feedback WHERE user_id = v_user_id;
  DELETE FROM public.system_events WHERE broadcaster_id = p_twitch_user_id;
  DELETE FROM public.irl_collector_tokens WHERE user_id = v_user_id;
  DELETE FROM public.irl_geo_track WHERE user_id = v_user_id;
  DELETE FROM public.user_roles WHERE user_id = v_user_id;
  DELETE FROM public.user_preferences WHERE user_id = v_user_id;
  DELETE FROM public.integrations_twitch WHERE user_id = v_user_id;
  DELETE FROM public.integrations WHERE user_id = v_user_id;
  DELETE FROM public.users WHERE id = v_user_id;

  RETURN v_user_id;
END;
$$;

ALTER FUNCTION "public"."delete_user_data"("p_twitch_user_id" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_all_clips_with_folders"() RETURNS TABLE("id" bigint, "title" "text", "twitch_clip_id" "text", "creator_name" "text", "game_name" "text", "url" "text", "thumbnail_url" "text", "created_at" timestamp with time zone, "view_count" integer, "duration" numeric, "broadcaster_name" "text", "created_at_twitch" timestamp with time zone, "user_id" "uuid", "embed_url" "text", "broadcaster_id" "text", "creator_id" "text", "video_id" "text", "game_id" "text", "language" "text", "vod_offset" integer, "is_featured" boolean, "folders" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.title,
        c.twitch_clip_id,
        c.creator_name,
        c.game_name,
        c.url,
        c.thumbnail_url,
        c.created_at,
        c.view_count,
        c.duration,
        c.broadcaster_name,
        c.created_at_twitch,
        c.user_id,
        c.embed_url,
        c.broadcaster_id,
        c.creator_id,
        c.video_id,
        c.game_id,
        c.language,
        c.vod_offset,
        c.is_featured,
        COALESCE(
            JSONB_AGG(DISTINCT jsonb_build_object(
                'id', cf.id, 
                'name', cf.name, 
                'href', cf.href
            )) FILTER (WHERE cf.id IS NOT NULL),
            '[]'::jsonb
        ) AS folders
    FROM 
        public.clips c
    LEFT JOIN 
        public.clip_folder_junction cfj ON c.twitch_clip_id = cfj.clip_id
    LEFT JOIN 
        public.clip_folders cf ON cfj.folder_id = cf.id
    GROUP BY 
        c.id;
END;
$$;

ALTER FUNCTION "public"."get_all_clips_with_folders"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_clips_by_folder"("folder_href" "text") RETURNS TABLE("id" bigint, "title" "text", "twitch_clip_id" "text", "creator_name" "text", "game_name" "text", "url" "text", "thumbnail_url" "text", "created_at" timestamp with time zone, "view_count" integer, "duration" numeric, "broadcaster_name" "text", "created_at_twitch" timestamp with time zone, "user_id" "uuid", "embed_url" "text", "broadcaster_id" "text", "creator_id" "text", "video_id" "text", "game_id" "text", "language" "text", "vod_offset" integer, "is_featured" boolean, "folders" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.title,
        c.twitch_clip_id,
        c.creator_name,
        c.game_name,
        c.url,
        c.thumbnail_url,
        c.created_at,
        c.view_count,
        c.duration,
        c.broadcaster_name,
        c.created_at_twitch,
        c.user_id,
        c.embed_url,
        c.broadcaster_id,
        c.creator_id,
        c.video_id,
        c.game_id,
        c.language,
        c.vod_offset,
        c.is_featured,
        JSONB_AGG(DISTINCT jsonb_build_object('id', cf.id, 'name', cf.name, 'href', cf.href)) AS folders
    FROM 
        public.clips c
    JOIN 
        public.clip_folder_junction cfj ON c.twitch_clip_id = cfj.clip_id
    JOIN 
        public.clip_folders cf ON cfj.folder_id = cf.id
    WHERE 
        c.twitch_clip_id IN (
            SELECT 
                c_sub.twitch_clip_id
            FROM 
                public.clips c_sub
            JOIN 
                public.clip_folder_junction cfj_sub ON c_sub.twitch_clip_id = cfj_sub.clip_id
            JOIN 
                public.clip_folders cf_sub ON cfj_sub.folder_id = cf_sub.id
            WHERE 
                cf_sub.href = folder_href
        )
    GROUP BY 
        c.id, c.title, c.twitch_clip_id, c.creator_name, c.game_name, 
        c.url, c.thumbnail_url, c.created_at, c.view_count, c.duration, 
        c.broadcaster_name, c.created_at_twitch, c.user_id, c.embed_url, 
        c.broadcaster_id, c.creator_id, c.video_id, c.game_id, c.language, 
        c.vod_offset, c.is_featured;
END;
$$;

ALTER FUNCTION "public"."get_clips_by_folder"("folder_href" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_stream_data"("p_video_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_stream_id TEXT;
BEGIN
  -- Look up the stream_id from the vods table
  SELECT v.stream_id INTO v_stream_id
  FROM vods v
  WHERE v.video_id = p_video_id;

  RETURN jsonb_build_object(
    'stream_events', COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(se) ORDER BY se.offset_seconds ASC)
        FROM stream_events se
        WHERE se.stream_id = v_stream_id
          AND v_stream_id IS NOT NULL
      ),
      '[]'::jsonb
    ),
    'clips', COALESCE(
      (
        SELECT jsonb_agg(
          to_jsonb(c) || jsonb_build_object(
            'folder_ids', COALESCE(
              (
                SELECT jsonb_agg(cfj.folder_id ORDER BY cfj.folder_id)
                FROM clip_folder_junction cfj
                WHERE cfj.clip_id = c.twitch_clip_id
                  AND cfj.folder_id IS NOT NULL
              ),
              '[]'::jsonb
            )
          ) ORDER BY c.vod_offset ASC NULLS LAST
        )
        FROM clips c
        WHERE c.video_id = p_video_id
      ),
      '[]'::jsonb
    )
  );
END;
$$;

ALTER FUNCTION "public"."get_stream_data"("p_video_id" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."get_user_twitch_ids"() RETURNS "text"[]
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN ARRAY(
    SELECT it.twitch_user_id
    FROM public.integrations_twitch it
    WHERE it.user_id = auth.uid()
  );
END;
$$;

ALTER FUNCTION "public"."get_user_twitch_ids"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO public.users (
        id,
        email,
        name,
        avatar_url,
        role
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL),
        'user'
    );
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE LOG 'Error in handle_new_user: %', SQLERRM;
        RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."handle_new_user_integration"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    provider_type_value public.provider_type;
    raw_provider_type TEXT;
    integration_id UUID;
BEGIN
    raise warning 'starting new inter';

    -- Retrieve provider type from `raw_app_meta_data`
    raw_provider_type := NEW.raw_app_meta_data->>'provider';

    -- Validate provider type
    BEGIN
        provider_type_value := raw_provider_type::public.provider_type;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING 'Unsupported provider type: %. Must be a valid provider_type ENUM value.', raw_provider_type;
            RETURN NEW;
    END;

    -- Debug LOG
    RAISE LOG 'Processing integration for provider type: %', provider_type_value;

    -- Use the insert_integration function
    integration_id := public.insert_integration(NEW.id, provider_type_value);

    -- Call appropriate provider-specific function based on the provider type
    CASE provider_type_value
        WHEN 'twitch' THEN
            PERFORM public.insert_twitch_integration(integration_id, NEW.raw_user_meta_data, NEW.id);
        WHEN 'discord' THEN
            PERFORM public.insert_discord_integration(integration_id, NEW.raw_user_meta_data, NEW.id);
    END CASE;

    RETURN NEW;

EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in handle_new_user_integration: %', SQLERRM;
        RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."handle_new_user_integration"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."increment_widget_installs"("entry_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  UPDATE widget_library_entries SET installs = installs + 1 WHERE id = entry_id;
$$;

ALTER FUNCTION "public"."increment_widget_installs"("entry_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."insert_discord_integration"("integration_id" "uuid", "provider_data" "jsonb", "user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO public.integrations_discord (
        id,
        user_id,
        access_token,
        refresh_token,
        token_expires_at,
        discord_username,
        discord_user_id,
        avatar,
        email,
        server_id,
        roles
    ) VALUES (
        integration_id,
        user_id,
        provider_data->>'access_token',
        provider_data->>'refresh_token',
        (provider_data->>'expires_at')::timestamptz,
        provider_data->>'username',
        provider_data->>'user_id',
        provider_data->>'avatar',
        provider_data->>'email',
        provider_data->>'server_id',
        COALESCE(provider_data->'roles', '[]'::jsonb)
    );

    RAISE LOG 'Successfully inserted Discord integration data';
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error inserting Discord integration data: %', SQLERRM;
        -- Re-raise the exception to be handled by the calling function
        RAISE;
END;
$$;

ALTER FUNCTION "public"."insert_discord_integration"("integration_id" "uuid", "provider_data" "jsonb", "user_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."insert_integration"("p_user_id" "uuid", "p_provider_type" "public"."provider_type") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_integration_id UUID;
BEGIN
    -- Insert into main integrations table
    INSERT INTO public.integrations (
        user_id,
        type,
        is_active
    ) VALUES (
        p_user_id,
        p_provider_type,
        true
    ) RETURNING id INTO v_integration_id;

    RETURN v_integration_id;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in insert_integration: %', SQLERRM;
        RAISE;
END;
$$;

ALTER FUNCTION "public"."insert_integration"("p_user_id" "uuid", "p_provider_type" "public"."provider_type") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."insert_twitch_integration"("integration_id" "uuid", "provider_data" "jsonb", "user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO public.integrations_twitch (
        id,
        user_id,
        token_expires_at,
        twitch_username,
        twitch_user_id,
        profile_image_url,
        email,
        broadcaster_type,
        description
    ) VALUES (
        integration_id,
        user_id,
        (provider_data->>'expires_at')::timestamptz,
        provider_data->>'nickname',
        provider_data->>'provider_id',
        provider_data->>'avatar_url',
        provider_data->>'email',
        provider_data->'custom_claims'->>'broadcaster_type',  
        provider_data->'custom_claims'->>'description'  
    );

    RAISE LOG 'Successfully inserted Twitch integration data';
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error inserting Twitch integration data: %', SQLERRM;
        -- Re-raise the exception to be handled by the calling function
        RAISE;
END;
$$;

ALTER FUNCTION "public"."insert_twitch_integration"("integration_id" "uuid", "provider_data" "jsonb", "user_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."jwt_broadcaster_id"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT twitch_user_id
  FROM public.integrations_twitch
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

ALTER FUNCTION "public"."jwt_broadcaster_id"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."remove_clip_from_folder"("p_clip_id" "uuid", "p_folder_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  delete from clip_folder_junction 
  where clip_id = p_clip_id 
    and folder_id = p_folder_id 
    and user_id = auth.uid();
end;
$$;

ALTER FUNCTION "public"."remove_clip_from_folder"("p_clip_id" "uuid", "p_folder_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."sync_all_default_commands"() RETURNS TABLE("total_channels" integer, "total_commands_added" integer)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  result_channels INTEGER;
  result_commands INTEGER;
BEGIN
  SELECT 
    COUNT(DISTINCT returned_channel_id)::INTEGER,
    SUM(commands_added)::INTEGER
  INTO result_channels, result_commands
  FROM sync_default_commands_for_channels();
  
  RETURN QUERY SELECT result_channels, COALESCE(result_commands, 0);
END;
$$;

ALTER FUNCTION "public"."sync_all_default_commands"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."sync_default_commands_for_channels"("target_channel_id" "text" DEFAULT NULL::"text") RETURNS TABLE("returned_channel_id" "text", "commands_added" integer)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- If a specific channel_id is provided, sync only that channel
  -- Otherwise, sync all channels
  RETURN QUERY
  WITH channels_to_sync AS (
    SELECT it.twitch_user_id
    FROM public.integrations_twitch it
    WHERE target_channel_id IS NULL OR it.twitch_user_id = target_channel_id
  ),
  missing_commands AS (
    SELECT 
      cts.twitch_user_id,
      dcc.id as default_command_id
    FROM channels_to_sync cts
    CROSS JOIN public.default_chat_commands dcc
    LEFT JOIN public.commands c 
      ON c.channel_id = cts.twitch_user_id 
      AND c.default_command_id = dcc.id
    WHERE c.id IS NULL  -- Only get commands that don't exist yet
  ),
  inserted_commands AS (
    INSERT INTO public.commands (default_command_id, enabled, channel_id)
    SELECT 
      mc.default_command_id,
      true,
      mc.twitch_user_id
    FROM missing_commands mc
    RETURNING channel_id, default_command_id
  )
  SELECT 
    ic.channel_id,
    COUNT(*)::INTEGER as commands_added
  FROM inserted_commands ic
  GROUP BY ic.channel_id;
END;
$$;

ALTER FUNCTION "public"."sync_default_commands_for_channels"("target_channel_id" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_overlay_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."update_overlay_updated_at"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."user_owns_channel"("channel_id" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN channel_id = ANY(public.get_user_twitch_ids());
END;
$$;

ALTER FUNCTION "public"."user_owns_channel"("channel_id" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

CREATE TABLE IF NOT EXISTS "analytics"."followers" (
    "user_id" "text",
    "user_login" "text",
    "user_name" "text",
    "broadcaster_user_id" "text",
    "broadcaster_user_login" "text",
    "broadcaster_user_name" "text",
    "followed_at" timestamp without time zone,
    "stream_id" "text"
);

ALTER TABLE "analytics"."followers" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "analytics"."streams" (
    "stream_id" "text" NOT NULL,
    "broadcaster_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "category" "text",
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "analytics"."streams" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."broadcaster_live_status" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "broadcaster_id" "text" NOT NULL,
    "stream_id" "text",
    "is_live" boolean DEFAULT false NOT NULL,
    "stream_started_at" timestamp with time zone,
    "stream_ended_at" timestamp with time zone,
    "title" "text",
    "category_id" "text",
    "category_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "broadcaster_name" "text" NOT NULL
);

ALTER TABLE "public"."broadcaster_live_status" OWNER TO "postgres";

COMMENT ON TABLE "public"."broadcaster_live_status" IS 'Tracks the current live status of broadcasters';

COMMENT ON COLUMN "public"."broadcaster_live_status"."broadcaster_id" IS 'Twitch broadcaster ID';

COMMENT ON COLUMN "public"."broadcaster_live_status"."stream_id" IS 'Twitch stream ID';

COMMENT ON COLUMN "public"."broadcaster_live_status"."is_live" IS 'Current live status of the broadcaster';

COMMENT ON COLUMN "public"."broadcaster_live_status"."stream_started_at" IS 'When the current stream started (null if not live)';

COMMENT ON COLUMN "public"."broadcaster_live_status"."stream_ended_at" IS 'When the stream ended (set when stream goes offline)';

CREATE TABLE IF NOT EXISTS "public"."clip_folder_junction" (
    "id" bigint NOT NULL,
    "clip_id" "text" NOT NULL,
    "folder_id" bigint,
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE "public"."clip_folder_junction" OWNER TO "postgres";

ALTER TABLE "public"."clip_folder_junction" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."clip_folder_junction_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."clip_folders" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "parent_folder_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "href" "text" NOT NULL
);

ALTER TABLE "public"."clip_folders" OWNER TO "postgres";

ALTER TABLE "public"."clip_folders" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."clip_folders_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."clips" (
    "id" bigint NOT NULL,
    "twitch_clip_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "creator_name" "text" NOT NULL,
    "game_name" "text",
    "url" "text" NOT NULL,
    "thumbnail_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "view_count" integer DEFAULT 0,
    "duration" numeric,
    "broadcaster_name" "text" NOT NULL,
    "created_at_twitch" timestamp with time zone NOT NULL,
    "user_id" "uuid" NOT NULL,
    "embed_url" "text",
    "broadcaster_id" "text" NOT NULL,
    "creator_id" "text" NOT NULL,
    "video_id" "text",
    "game_id" "text",
    "language" "text",
    "vod_offset" integer,
    "is_featured" boolean DEFAULT false NOT NULL
);

ALTER TABLE "public"."clips" OWNER TO "postgres";

ALTER TABLE "public"."clips" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."clips_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

CREATE TABLE IF NOT EXISTS "public"."commands" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "channel_id" "text" NOT NULL,
    "custom_command_id" "uuid",
    "default_command_id" "uuid"
);

ALTER TABLE "public"."commands" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."custom_commands" (
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "command" "text" NOT NULL,
    "message" "text",
    "action" "text",
    "context" "jsonb",
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);

ALTER TABLE "public"."custom_commands" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."default_chat_commands" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "command" "text" NOT NULL,
    "message" "text" NOT NULL,
    "action" "text",
    "context" "jsonb"
);

ALTER TABLE "public"."default_chat_commands" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."feedback" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "category" "public"."feedback_category" NOT NULL,
    "priority" "public"."feedback_priority" NOT NULL,
    "status" "public"."feedback_status" DEFAULT 'open'::"public"."feedback_status" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "discord" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "feedback_description_check" CHECK ((("char_length"("description") >= 10) AND ("char_length"("description") <= 2000))),
    CONSTRAINT "feedback_discord_check" CHECK ((("discord" IS NULL) OR (("char_length"("discord") >= 3) AND ("char_length"("discord") <= 120)))),
    CONSTRAINT "feedback_title_check" CHECK ((("char_length"("title") >= 3) AND ("char_length"("title") <= 120)))
);

ALTER TABLE "public"."feedback" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."integrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "public"."provider_type" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."integrations" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."integrations_twitch" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token_expires_at" timestamp with time zone,
    "twitch_username" "text" NOT NULL,
    "twitch_user_id" "text" NOT NULL,
    "profile_image_url" "text",
    "email" "text",
    "broadcaster_type" "text",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "access_token_ciphertext" "text",
    "access_token_iv" "text",
    "access_token_tag" "text",
    "refresh_token_ciphertext" "text",
    "refresh_token_iv" "text",
    "refresh_token_tag" "text"
);

ALTER TABLE "public"."integrations_twitch" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."irl_collector_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "name" "text" DEFAULT 'My IRL Device'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_used_at" timestamp with time zone
);

ALTER TABLE "public"."irl_collector_tokens" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."irl_geo_track" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "session_id" "uuid" NOT NULL,
    "stream_id" "text",
    "latitude" double precision NOT NULL,
    "longitude" double precision NOT NULL,
    "altitude" double precision,
    "speed" double precision,
    "heading" double precision,
    "accuracy" double precision,
    "recorded_at" timestamp with time zone NOT NULL,
    "inserted_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."irl_geo_track" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."overlay_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "scene_id" "uuid" NOT NULL,
    "type" "text" DEFAULT 'clips_widget'::"text" NOT NULL,
    "x" real DEFAULT 0 NOT NULL,
    "y" real DEFAULT 0 NOT NULL,
    "w" real DEFAULT 400 NOT NULL,
    "h" real DEFAULT 300 NOT NULL,
    "z_index" integer DEFAULT 0 NOT NULL,
    "rotation" real DEFAULT 0 NOT NULL,
    "opacity" real DEFAULT 1 NOT NULL,
    "is_visible" boolean DEFAULT true NOT NULL,
    "is_locked" boolean DEFAULT false NOT NULL,
    "label" "text" DEFAULT 'Untitled'::"text" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."overlay_items" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."overlay_scenes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "width" integer DEFAULT 1920 NOT NULL,
    "height" integer DEFAULT 1080 NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "subscriber_token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(32), 'hex'::"text") NOT NULL,
    "render_mode" "text" DEFAULT 'obs'::"text" NOT NULL,
    CONSTRAINT "overlay_scenes_render_mode_check" CHECK (("render_mode" = ANY (ARRAY['obs'::"text", 'phone'::"text"])))
);

ALTER TABLE "public"."overlay_scenes" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."overlay_widget_instances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "overlay_item_id" "uuid" NOT NULL,
    "widget_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "field_values" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "widget_state" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);

ALTER TABLE "public"."overlay_widget_instances" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."pending_clips" (
    "clip_id" "text" NOT NULL,
    "broadcaster_id" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "retry_count" integer DEFAULT 0 NOT NULL,
    "max_retries" integer DEFAULT 20 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_checked_at" timestamp with time zone,
    "next_retry_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "error_message" "text",
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    CONSTRAINT "pending_clips_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'ready'::"text", 'failed'::"text"])))
);

ALTER TABLE "public"."pending_clips" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."smp_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "action" "text" NOT NULL,
    "metadata" "jsonb",
    "trigger" "text"
);

ALTER TABLE "public"."smp_actions" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."smp_channelpoints_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "title" "text" NOT NULL,
    "cost" integer NOT NULL,
    "prompt" "text",
    "is_enabled" boolean,
    "background_color" "text",
    "is_user_input_required" boolean,
    "is_max_per_stream_enabled" boolean,
    "max_per_stream" integer,
    "is_max_per_user_per_stream_enabled" boolean,
    "max_per_user_per_stream" integer,
    "is_global_cooldown_enabled" boolean,
    "global_cooldown_seconds" integer,
    "should_redemptions_skip_request_queue" boolean,
    "action" "uuid"
);

ALTER TABLE "public"."smp_channelpoints_templates" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."smp_players" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "broadcaster_id" "text",
    "minecraft_player_uuid" "uuid",
    "is_online" boolean DEFAULT false NOT NULL
);

ALTER TABLE "public"."smp_players" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."smp_triggers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "event_type" "text" NOT NULL,
    "action_id" "uuid",
    "conditions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL
);

ALTER TABLE "public"."smp_triggers" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."stream_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "event_type" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "broadcaster_id" "text" NOT NULL,
    "stream_id" "text" NOT NULL,
    "event_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'received'::"text" NOT NULL,
    "offset_seconds" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "stream_events_provider_check" CHECK (("provider" = ANY (ARRAY['twitch'::"text", 'minecraft'::"text"]))),
    CONSTRAINT "stream_events_status_check" CHECK (("status" = ANY (ARRAY['received'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text", 'retrying'::"text"])))
);

ALTER TABLE "public"."stream_events" OWNER TO "postgres";

COMMENT ON TABLE "public"."stream_events" IS 'Stores Twitch and Minecraft events for analytics and stream monitoring';

COMMENT ON COLUMN "public"."stream_events"."provider" IS 'Event provider: twitch or minecraft';

COMMENT ON COLUMN "public"."stream_events"."broadcaster_id" IS 'Twitch broadcaster/channel ID';

COMMENT ON COLUMN "public"."stream_events"."event_data" IS 'The raw event payload';

COMMENT ON COLUMN "public"."stream_events"."metadata" IS 'Additional metadata like processing info';

CREATE TABLE IF NOT EXISTS "public"."stream_viewer_counts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stream_id" "text" NOT NULL,
    "broadcaster_id" "text" NOT NULL,
    "viewer_count" integer NOT NULL,
    "game_id" "text",
    "game_name" "text",
    "title" "text",
    "recorded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "offset_seconds" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."stream_viewer_counts" OWNER TO "postgres";

COMMENT ON TABLE "public"."stream_viewer_counts" IS 'Stores periodic viewer count snapshots during live streams for analytics';

COMMENT ON COLUMN "public"."stream_viewer_counts"."stream_id" IS 'Twitch stream ID from broadcaster_live_status';

COMMENT ON COLUMN "public"."stream_viewer_counts"."recorded_at" IS 'UTC timestamp when this snapshot was taken';

COMMENT ON COLUMN "public"."stream_viewer_counts"."offset_seconds" IS 'Seconds since stream started, useful for graph X-axis';

CREATE TABLE IF NOT EXISTS "public"."system_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "event_type" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "broadcaster_id" "text",
    "event_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'completed'::"text" NOT NULL,
    "error_message" "text",
    CONSTRAINT "system_events_provider_check" CHECK (("provider" = ANY (ARRAY['api'::"text", 'system'::"text"]))),
    CONSTRAINT "system_events_status_check" CHECK (("status" = ANY (ARRAY['received'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text", 'retrying'::"text"])))
);

ALTER TABLE "public"."system_events" OWNER TO "postgres";

COMMENT ON TABLE "public"."system_events" IS 'Stores API and system events for internal logging and debugging';

COMMENT ON COLUMN "public"."system_events"."provider" IS 'Event provider: api or system';

COMMENT ON COLUMN "public"."system_events"."broadcaster_id" IS 'Optional broadcaster ID for broadcaster-specific system events';

COMMENT ON COLUMN "public"."system_events"."event_data" IS 'The raw event payload';

COMMENT ON COLUMN "public"."system_events"."metadata" IS 'Additional metadata like user_id, IP address, etc.';

CREATE TABLE IF NOT EXISTS "public"."testimonials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "content" "text" NOT NULL,
    "active" boolean DEFAULT false NOT NULL,
    "username" "text" NOT NULL,
    "href" "text" NOT NULL,
    "profile_img" "text" NOT NULL,
    "user_id" "uuid"
);

ALTER TABLE "public"."testimonials" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."twitch_app_token" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "access_token" "text" NOT NULL,
    "expires_in" integer NOT NULL,
    "token_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text") NOT NULL,
    "access_token_ciphertext" "text",
    "access_token_iv" "text",
    "access_token_tag" "text"
);

ALTER TABLE "public"."twitch_app_token" OWNER TO "postgres";

COMMENT ON COLUMN "public"."twitch_app_token"."access_token_ciphertext" IS 'AES-256-GCM encrypted access token (base64)';

COMMENT ON COLUMN "public"."twitch_app_token"."access_token_iv" IS 'Initialization vector for encryption (base64)';

COMMENT ON COLUMN "public"."twitch_app_token"."access_token_tag" IS 'Authentication tag for GCM mode (base64)';

CREATE TABLE IF NOT EXISTS "public"."twitch_clip_syncs" (
    "id" integer NOT NULL,
    "last_sync" timestamp with time zone NOT NULL,
    "clip_count" integer NOT NULL,
    "sync_status" "public"."clip_sync_status" NOT NULL,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "user_id" "uuid" NOT NULL
);

ALTER TABLE "public"."twitch_clip_syncs" OWNER TO "postgres";

CREATE SEQUENCE IF NOT EXISTS "public"."twitch_clip_syncs_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE "public"."twitch_clip_syncs_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."twitch_clip_syncs_id_seq" OWNED BY "public"."twitch_clip_syncs"."id";

CREATE TABLE IF NOT EXISTS "public"."user_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "theme" "public"."theme_type" DEFAULT 'dark'::"public"."theme_type",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "sync_clips_on_end" boolean DEFAULT false NOT NULL
);

ALTER TABLE "public"."user_preferences" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'default_user'::"text" NOT NULL
);

ALTER TABLE "public"."user_roles" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text" NOT NULL,
    "avatar_url" "text",
    "role" "text" DEFAULT 'user'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."users" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."vods" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stream_id" "text",
    "video_id" "text" NOT NULL,
    "broadcaster_id" "text" NOT NULL,
    "started_at" timestamp with time zone
);

ALTER TABLE "public"."vods" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."widget_library_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "widget_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "likes" integer DEFAULT 0 NOT NULL,
    "installs" integer DEFAULT 0 NOT NULL,
    "is_approved" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."widget_library_entries" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."widgets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "html" "text" DEFAULT ''::"text" NOT NULL,
    "js" "text" DEFAULT ''::"text" NOT NULL,
    "extra_css" "text" DEFAULT ''::"text" NOT NULL,
    "fields" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "preview_url" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."widgets" OWNER TO "postgres";

ALTER TABLE ONLY "public"."twitch_clip_syncs" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."twitch_clip_syncs_id_seq"'::"regclass");

ALTER TABLE ONLY "analytics"."streams"
    ADD CONSTRAINT "streams_pkey" PRIMARY KEY ("stream_id");

ALTER TABLE ONLY "public"."broadcaster_live_status"
    ADD CONSTRAINT "broadcaster_live_status_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."clip_folder_junction"
    ADD CONSTRAINT "clip_folder_junction_clip_id_folder_id_key" UNIQUE ("clip_id", "folder_id");

ALTER TABLE ONLY "public"."clip_folder_junction"
    ADD CONSTRAINT "clip_folder_junction_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."clip_folders"
    ADD CONSTRAINT "clip_folders_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."clips"
    ADD CONSTRAINT "clips_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."clips"
    ADD CONSTRAINT "clips_twitch_clip_id_key" UNIQUE ("twitch_clip_id");

ALTER TABLE ONLY "public"."commands"
    ADD CONSTRAINT "command_settings_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."custom_commands"
    ADD CONSTRAINT "custom_commands_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."default_chat_commands"
    ADD CONSTRAINT "default_chat_commands_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."integrations"
    ADD CONSTRAINT "integrations_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."integrations_twitch"
    ADD CONSTRAINT "integrations_twitch_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."integrations_twitch"
    ADD CONSTRAINT "integrations_twitch_twitch_user_id_key" UNIQUE ("twitch_user_id");

ALTER TABLE ONLY "public"."integrations"
    ADD CONSTRAINT "integrations_user_id_key" UNIQUE ("user_id");

ALTER TABLE ONLY "public"."irl_collector_tokens"
    ADD CONSTRAINT "irl_collector_tokens_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."irl_collector_tokens"
    ADD CONSTRAINT "irl_collector_tokens_token_key" UNIQUE ("token");

ALTER TABLE ONLY "public"."irl_geo_track"
    ADD CONSTRAINT "irl_geo_track_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."overlay_items"
    ADD CONSTRAINT "overlay_items_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."overlay_scenes"
    ADD CONSTRAINT "overlay_scenes_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."overlay_scenes"
    ADD CONSTRAINT "overlay_scenes_subscriber_token_key" UNIQUE ("subscriber_token");

ALTER TABLE ONLY "public"."overlay_scenes"
    ADD CONSTRAINT "overlay_scenes_user_id_slug_key" UNIQUE ("user_id", "slug");

ALTER TABLE ONLY "public"."overlay_widget_instances"
    ADD CONSTRAINT "overlay_widget_instances_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."pending_clips"
    ADD CONSTRAINT "pending_clips_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."smp_actions"
    ADD CONSTRAINT "smp_actions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."smp_channelpoints_templates"
    ADD CONSTRAINT "smp_channelpoints_templates_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."smp_players"
    ADD CONSTRAINT "smp_players_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."smp_players"
    ADD CONSTRAINT "smp_players_user_id_key" UNIQUE ("user_id");

ALTER TABLE ONLY "public"."smp_triggers"
    ADD CONSTRAINT "smp_triggers_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."stream_events"
    ADD CONSTRAINT "stream_events_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."stream_viewer_counts"
    ADD CONSTRAINT "stream_viewer_counts_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."system_events"
    ADD CONSTRAINT "system_events_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."testimonials"
    ADD CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."twitch_app_token"
    ADD CONSTRAINT "twitch_app_token_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."twitch_clip_syncs"
    ADD CONSTRAINT "twitch_clip_syncs_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."twitch_clip_syncs"
    ADD CONSTRAINT "twitch_clip_syncs_user_id_key" UNIQUE ("user_id");

ALTER TABLE ONLY "public"."broadcaster_live_status"
    ADD CONSTRAINT "unique_broadcaster_live_status" UNIQUE ("broadcaster_id");

ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_key" UNIQUE ("user_id");

ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."vods"
    ADD CONSTRAINT "vods_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."vods"
    ADD CONSTRAINT "vods_stream_id_key" UNIQUE ("stream_id");

ALTER TABLE ONLY "public"."vods"
    ADD CONSTRAINT "vods_video_id_key" UNIQUE ("video_id");

ALTER TABLE ONLY "public"."widget_library_entries"
    ADD CONSTRAINT "widget_library_entries_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."widgets"
    ADD CONSTRAINT "widgets_pkey" PRIMARY KEY ("id");

CREATE INDEX "clips_broadcaster_id_idx" ON "public"."clips" USING "btree" ("broadcaster_id");

CREATE INDEX "clips_creator_id_idx" ON "public"."clips" USING "btree" ("creator_id");

CREATE INDEX "clips_game_id_idx" ON "public"."clips" USING "btree" ("game_id");

CREATE INDEX "feedback_created_at_idx" ON "public"."feedback" USING "btree" ("created_at" DESC);

CREATE INDEX "feedback_status_idx" ON "public"."feedback" USING "btree" ("status");

CREATE INDEX "feedback_user_id_idx" ON "public"."feedback" USING "btree" ("user_id");

CREATE INDEX "idx_broadcaster_live_status_broadcaster_id" ON "public"."broadcaster_live_status" USING "btree" ("broadcaster_id");

CREATE INDEX "idx_broadcaster_live_status_is_live" ON "public"."broadcaster_live_status" USING "btree" ("is_live");

CREATE INDEX "idx_broadcaster_live_status_started_at" ON "public"."broadcaster_live_status" USING "btree" ("stream_started_at");

CREATE INDEX "idx_clip_folder_junction_clip_id" ON "public"."clip_folder_junction" USING "btree" ("clip_id");

CREATE INDEX "idx_clip_folder_junction_folder_id" ON "public"."clip_folder_junction" USING "btree" ("folder_id");

CREATE INDEX "idx_clip_folder_junction_user_id" ON "public"."clip_folder_junction" USING "btree" ("user_id");

CREATE INDEX "idx_clip_folders_parent_folder_id" ON "public"."clip_folders" USING "btree" ("parent_folder_id");

CREATE INDEX "idx_clip_folders_user_id" ON "public"."clip_folders" USING "btree" ("user_id");

CREATE INDEX "idx_overlay_items_scene_id" ON "public"."overlay_items" USING "btree" ("scene_id");

CREATE INDEX "idx_overlay_scenes_slug" ON "public"."overlay_scenes" USING "btree" ("slug");

CREATE INDEX "idx_overlay_scenes_user_id" ON "public"."overlay_scenes" USING "btree" ("user_id");

CREATE INDEX "idx_stream_events_broadcaster_created" ON "public"."stream_events" USING "btree" ("broadcaster_id", "created_at" DESC);

CREATE INDEX "idx_stream_events_broadcaster_id" ON "public"."stream_events" USING "btree" ("broadcaster_id");

CREATE INDEX "idx_stream_events_created_at" ON "public"."stream_events" USING "btree" ("created_at" DESC);

CREATE INDEX "idx_stream_events_event_data" ON "public"."stream_events" USING "gin" ("event_data");

CREATE INDEX "idx_stream_events_event_type" ON "public"."stream_events" USING "btree" ("event_type");

CREATE INDEX "idx_stream_events_metadata" ON "public"."stream_events" USING "gin" ("metadata");

CREATE INDEX "idx_stream_events_provider" ON "public"."stream_events" USING "btree" ("provider");

CREATE INDEX "idx_stream_events_status" ON "public"."stream_events" USING "btree" ("status");

CREATE INDEX "idx_stream_viewer_counts_broadcaster_id" ON "public"."stream_viewer_counts" USING "btree" ("broadcaster_id");

CREATE INDEX "idx_stream_viewer_counts_recorded_at" ON "public"."stream_viewer_counts" USING "btree" ("recorded_at");

CREATE INDEX "idx_stream_viewer_counts_stream_id" ON "public"."stream_viewer_counts" USING "btree" ("stream_id");

CREATE INDEX "idx_stream_viewer_counts_stream_offset" ON "public"."stream_viewer_counts" USING "btree" ("stream_id", "offset_seconds");

CREATE INDEX "idx_system_events_broadcaster_id" ON "public"."system_events" USING "btree" ("broadcaster_id") WHERE ("broadcaster_id" IS NOT NULL);

CREATE INDEX "idx_system_events_created_at" ON "public"."system_events" USING "btree" ("created_at" DESC);

CREATE INDEX "idx_system_events_event_data" ON "public"."system_events" USING "gin" ("event_data");

CREATE INDEX "idx_system_events_event_type" ON "public"."system_events" USING "btree" ("event_type");

CREATE INDEX "idx_system_events_metadata" ON "public"."system_events" USING "gin" ("metadata");

CREATE INDEX "idx_system_events_provider" ON "public"."system_events" USING "btree" ("provider");

CREATE INDEX "idx_system_events_status" ON "public"."system_events" USING "btree" ("status");

CREATE INDEX "idx_user_preferences_user_id" ON "public"."user_preferences" USING "btree" ("user_id");

CREATE INDEX "irl_geo_track_session_idx" ON "public"."irl_geo_track" USING "btree" ("session_id", "recorded_at");

CREATE INDEX "irl_geo_track_stream_idx" ON "public"."irl_geo_track" USING "btree" ("stream_id", "recorded_at");

CREATE INDEX "irl_geo_track_user_idx" ON "public"."irl_geo_track" USING "btree" ("user_id", "recorded_at" DESC);

CREATE INDEX "pending_clips_broadcaster_id_idx" ON "public"."pending_clips" USING "btree" ("broadcaster_id");

CREATE INDEX "pending_clips_status_retry_idx" ON "public"."pending_clips" USING "btree" ("status", "next_retry_at");

CREATE OR REPLACE TRIGGER "feedback_updated_at" BEFORE UPDATE ON "public"."feedback" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "set_overlay_items_updated_at" BEFORE UPDATE ON "public"."overlay_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_overlay_updated_at"();

CREATE OR REPLACE TRIGGER "set_overlay_scenes_updated_at" BEFORE UPDATE ON "public"."overlay_scenes" FOR EACH ROW EXECUTE FUNCTION "public"."update_overlay_updated_at"();

CREATE OR REPLACE TRIGGER "trigger_create_default_commands" AFTER INSERT ON "public"."integrations_twitch" FOR EACH ROW EXECUTE FUNCTION "public"."create_default_commands_for_channel"();

CREATE OR REPLACE TRIGGER "twitch_app_token_upsert_updated_at" BEFORE INSERT OR UPDATE ON "public"."twitch_app_token" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_broadcaster_live_status_updated_at" BEFORE UPDATE ON "public"."broadcaster_live_status" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_stream_events_updated_at" BEFORE UPDATE ON "public"."stream_events" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_system_events_updated_at" BEFORE UPDATE ON "public"."system_events" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "update_user_preferences_updated_at" BEFORE UPDATE ON "public"."user_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

ALTER TABLE ONLY "analytics"."followers"
    ADD CONSTRAINT "followers_stream_id_fkey" FOREIGN KEY ("stream_id") REFERENCES "analytics"."streams"("stream_id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."broadcaster_live_status"
    ADD CONSTRAINT "broadcaster_live_status_broadcaster_id_fkey" FOREIGN KEY ("broadcaster_id") REFERENCES "public"."integrations_twitch"("twitch_user_id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "public"."clip_folder_junction"
    ADD CONSTRAINT "clip_folder_junction_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "public"."clip_folders"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."clip_folder_junction"
    ADD CONSTRAINT "clip_folder_junction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."clip_folders"
    ADD CONSTRAINT "clip_folders_parent_folder_id_fkey" FOREIGN KEY ("parent_folder_id") REFERENCES "public"."clip_folders"("id");

ALTER TABLE ONLY "public"."clip_folders"
    ADD CONSTRAINT "clip_folders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");

ALTER TABLE ONLY "public"."clips"
    ADD CONSTRAINT "clips_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "public"."clips"
    ADD CONSTRAINT "clips_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "public"."vods"("video_id");

ALTER TABLE ONLY "public"."commands"
    ADD CONSTRAINT "commands_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."integrations_twitch"("twitch_user_id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."commands"
    ADD CONSTRAINT "commands_custom_command_id_fkey" FOREIGN KEY ("custom_command_id") REFERENCES "public"."custom_commands"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "public"."commands"
    ADD CONSTRAINT "commands_default_command_id_fkey" FOREIGN KEY ("default_command_id") REFERENCES "public"."default_chat_commands"("id");

ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."stream_viewer_counts"
    ADD CONSTRAINT "fk_broadcaster" FOREIGN KEY ("broadcaster_id") REFERENCES "public"."integrations_twitch"("twitch_user_id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."integrations_twitch"
    ADD CONSTRAINT "integrations_twitch_id_fkey" FOREIGN KEY ("id") REFERENCES "public"."integrations"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."integrations_twitch"
    ADD CONSTRAINT "integrations_twitch_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."integrations"
    ADD CONSTRAINT "integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "public"."irl_collector_tokens"
    ADD CONSTRAINT "irl_collector_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."irl_geo_track"
    ADD CONSTRAINT "irl_geo_track_stream_id_fkey" FOREIGN KEY ("stream_id") REFERENCES "public"."vods"("stream_id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."irl_geo_track"
    ADD CONSTRAINT "irl_geo_track_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."overlay_items"
    ADD CONSTRAINT "overlay_items_scene_id_fkey" FOREIGN KEY ("scene_id") REFERENCES "public"."overlay_scenes"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."overlay_scenes"
    ADD CONSTRAINT "overlay_scenes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."overlay_widget_instances"
    ADD CONSTRAINT "overlay_widget_instances_overlay_item_id_fkey" FOREIGN KEY ("overlay_item_id") REFERENCES "public"."overlay_items"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."overlay_widget_instances"
    ADD CONSTRAINT "overlay_widget_instances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");

ALTER TABLE ONLY "public"."overlay_widget_instances"
    ADD CONSTRAINT "overlay_widget_instances_widget_id_fkey" FOREIGN KEY ("widget_id") REFERENCES "public"."widgets"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."pending_clips"
    ADD CONSTRAINT "pending_clips_broadcaster_id_fkey" FOREIGN KEY ("broadcaster_id") REFERENCES "public"."integrations_twitch"("twitch_user_id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."smp_channelpoints_templates"
    ADD CONSTRAINT "smp_channelpoints_templates_action_fkey" FOREIGN KEY ("action") REFERENCES "public"."smp_actions"("id") ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY "public"."smp_players"
    ADD CONSTRAINT "smp_players_broadcaster_id_fkey" FOREIGN KEY ("broadcaster_id") REFERENCES "public"."integrations_twitch"("twitch_user_id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "public"."smp_players"
    ADD CONSTRAINT "smp_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "public"."smp_triggers"
    ADD CONSTRAINT "smp_triggers_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "public"."smp_actions"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "public"."stream_events"
    ADD CONSTRAINT "stream_events_broadcaster_id_fkey" FOREIGN KEY ("broadcaster_id") REFERENCES "public"."integrations_twitch"("twitch_user_id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "public"."stream_events"
    ADD CONSTRAINT "stream_events_stream_id_fkey" FOREIGN KEY ("stream_id") REFERENCES "public"."vods"("stream_id") ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY "public"."stream_viewer_counts"
    ADD CONSTRAINT "stream_viewer_counts_stream_id_fkey" FOREIGN KEY ("stream_id") REFERENCES "public"."vods"("stream_id");

ALTER TABLE ONLY "public"."testimonials"
    ADD CONSTRAINT "testimonials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."twitch_clip_syncs"
    ADD CONSTRAINT "twitch_clip_syncs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."vods"
    ADD CONSTRAINT "vods_broadcaster_id_fkey" FOREIGN KEY ("broadcaster_id") REFERENCES "public"."integrations_twitch"("twitch_user_id");

ALTER TABLE ONLY "public"."widget_library_entries"
    ADD CONSTRAINT "widget_library_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");

ALTER TABLE ONLY "public"."widget_library_entries"
    ADD CONSTRAINT "widget_library_entries_widget_id_fkey" FOREIGN KEY ("widget_id") REFERENCES "public"."widgets"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."widgets"
    ADD CONSTRAINT "widgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");

CREATE POLICY "Admins can manage all feedback" ON "public"."feedback" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'admin'::"text")))));

CREATE POLICY "Anyone can view clips" ON "public"."clips" FOR SELECT USING (true);

CREATE POLICY "Authenticated users can view live status" ON "public"."broadcaster_live_status" FOR SELECT TO "authenticated" USING (true);

CREATE POLICY "Enable delete for users based on user_id" ON "public"."clip_folder_junction" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

CREATE POLICY "Enable delete for users based on user_id" ON "public"."clips" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

CREATE POLICY "Enable delete for users based on user_id" ON "public"."twitch_clip_syncs" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

CREATE POLICY "Enable insert for users based on user_id" ON "public"."clips" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

CREATE POLICY "Enable insert for users based on user_id" ON "public"."feedback" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

CREATE POLICY "Enable read access for all users" ON "public"."testimonials" FOR SELECT USING (true);

CREATE POLICY "Enable users to view their own data only" ON "public"."clip_folder_junction" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

CREATE POLICY "Enable users to view their own data only" ON "public"."pending_clips" FOR SELECT TO "authenticated" USING (("broadcaster_id" = "public"."jwt_broadcaster_id"()));

CREATE POLICY "Enable users to view their own data only" ON "public"."twitch_clip_syncs" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

CREATE POLICY "Public can read active scenes by slug" ON "public"."overlay_scenes" FOR SELECT USING (("is_active" = true));

CREATE POLICY "Public can read items of active scenes" ON "public"."overlay_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."overlay_scenes"
  WHERE (("overlay_scenes"."id" = "overlay_items"."scene_id") AND ("overlay_scenes"."is_active" = true)))));

CREATE POLICY "Public read approved entries" ON "public"."widget_library_entries" FOR SELECT USING (("is_approved" = true));

CREATE POLICY "SMP admin cal doo all" ON "public"."smp_actions" USING (( SELECT "public"."check_user_role"(( SELECT "auth"."uid"() AS "uid"), 'smp_admin'::"text") AS "check_user_role")) WITH CHECK (( SELECT "public"."check_user_role"(( SELECT "auth"."uid"() AS "uid"), 'smp_admin'::"text") AS "check_user_role"));

CREATE POLICY "Service role can manage live status" ON "public"."broadcaster_live_status" TO "service_role" USING (true);

CREATE POLICY "Service role has full access to stream events" ON "public"."stream_events" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));

CREATE POLICY "Service role has full access to system events" ON "public"."system_events" USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));

CREATE POLICY "Users can add clips to their own folders" ON "public"."clip_folder_junction" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1
   FROM "public"."clips"
  WHERE ("clips"."twitch_clip_id" = "clip_folder_junction"."clip_id"))) AND (EXISTS ( SELECT 1
   FROM "public"."clip_folders"
  WHERE (("clip_folders"."id" = "clip_folder_junction"."folder_id") AND ("clip_folders"."user_id" = "auth"."uid"()))))));

CREATE POLICY "Users can create their own folders" ON "public"."clip_folders" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can delete items of own scenes" ON "public"."overlay_items" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."overlay_scenes"
  WHERE (("overlay_scenes"."id" = "overlay_items"."scene_id") AND ("overlay_scenes"."user_id" = "auth"."uid"())))));

CREATE POLICY "Users can delete own preferences" ON "public"."user_preferences" FOR DELETE USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can delete own scenes" ON "public"."overlay_scenes" FOR DELETE USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can delete their own commands" ON "public"."commands" FOR DELETE USING ("public"."user_owns_channel"("channel_id"));

CREATE POLICY "Users can delete their own folders" ON "public"."clip_folders" FOR DELETE USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can insert commands for their own channels" ON "public"."commands" FOR INSERT WITH CHECK ("public"."user_owns_channel"("channel_id"));

CREATE POLICY "Users can insert items to own scenes" ON "public"."overlay_items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."overlay_scenes"
  WHERE (("overlay_scenes"."id" = "overlay_items"."scene_id") AND ("overlay_scenes"."user_id" = "auth"."uid"())))));

CREATE POLICY "Users can insert own preferences" ON "public"."user_preferences" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can insert own scenes" ON "public"."overlay_scenes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can insert their own stream events" ON "public"."stream_events" FOR INSERT WITH CHECK ("public"."user_owns_channel"("broadcaster_id"));

CREATE POLICY "Users can read own geo tracks" ON "public"."irl_geo_track" FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can read their own folders" ON "public"."clip_folders" FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can update items of own scenes" ON "public"."overlay_items" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."overlay_scenes"
  WHERE (("overlay_scenes"."id" = "overlay_items"."scene_id") AND ("overlay_scenes"."user_id" = "auth"."uid"())))));

CREATE POLICY "Users can update own clips" ON "public"."clips" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can update own preferences" ON "public"."user_preferences" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can update own scenes" ON "public"."overlay_scenes" FOR UPDATE USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can update their own commands" ON "public"."commands" FOR UPDATE USING ("public"."user_owns_channel"("channel_id")) WITH CHECK ("public"."user_owns_channel"("channel_id"));

CREATE POLICY "Users can update their own folders" ON "public"."clip_folders" FOR UPDATE USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can update their own stream events" ON "public"."stream_events" FOR UPDATE USING ("public"."user_owns_channel"("broadcaster_id"));

CREATE POLICY "Users can view items of own scenes" ON "public"."overlay_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."overlay_scenes"
  WHERE (("overlay_scenes"."id" = "overlay_items"."scene_id") AND ("overlay_scenes"."user_id" = "auth"."uid"())))));

CREATE POLICY "Users can view own feedback" ON "public"."feedback" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can view own preferences" ON "public"."user_preferences" FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can view own scenes" ON "public"."overlay_scenes" FOR SELECT USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users can view system events for their channels" ON "public"."system_events" FOR SELECT USING ((("broadcaster_id" IS NOT NULL) AND "public"."user_owns_channel"("broadcaster_id")));

CREATE POLICY "Users can view their own commands" ON "public"."commands" FOR SELECT USING ("public"."user_owns_channel"("channel_id"));

CREATE POLICY "Users can view their own stream events" ON "public"."stream_events" FOR SELECT USING ("public"."user_owns_channel"("broadcaster_id"));

CREATE POLICY "Users can view their own stream viewer counts" ON "public"."stream_viewer_counts" FOR SELECT USING ("public"."user_owns_channel"("broadcaster_id"));

CREATE POLICY "Users can view their own vods" ON "public"."vods" FOR SELECT USING ("public"."user_owns_channel"("broadcaster_id"));

CREATE POLICY "Users manage own entries" ON "public"."widget_library_entries" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users manage own instances" ON "public"."overlay_widget_instances" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users manage own tokens" ON "public"."irl_collector_tokens" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "Users manage own widgets" ON "public"."widgets" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "all user can read default commands" ON "public"."default_chat_commands" FOR SELECT TO "authenticated" USING (true);

ALTER TABLE "public"."broadcaster_live_status" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."clip_folder_junction" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."clip_folders" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."clips" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."commands" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."custom_commands" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."default_chat_commands" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."feedback" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."integrations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "integrations_select" ON "public"."integrations" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "integrations_select" ON "public"."integrations_twitch" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));

ALTER TABLE "public"."integrations_twitch" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "integrations_update" ON "public"."integrations" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));

CREATE POLICY "integrations_update" ON "public"."integrations_twitch" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));

ALTER TABLE "public"."irl_collector_tokens" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."irl_geo_track" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."overlay_items" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."overlay_scenes" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."overlay_widget_instances" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."pending_clips" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "smp admin can do all" ON "public"."smp_channelpoints_templates" USING (( SELECT "public"."check_user_role"(( SELECT "auth"."uid"() AS "uid"), 'smp_admin'::"text") AS "check_user_role")) WITH CHECK (( SELECT "public"."check_user_role"(( SELECT "auth"."uid"() AS "uid"), 'smp_admin'::"text") AS "check_user_role"));

CREATE POLICY "smp admin can do all" ON "public"."smp_triggers" USING (( SELECT "public"."check_user_role"(( SELECT "auth"."uid"() AS "uid"), 'smp_admin'::"text") AS "check_user_role")) WITH CHECK (( SELECT "public"."check_user_role"(( SELECT "auth"."uid"() AS "uid"), 'smp_admin'::"text") AS "check_user_role"));

ALTER TABLE "public"."smp_actions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "smp_admin_full_access" ON "public"."user_roles" TO "authenticated" USING (( SELECT "public"."check_user_role"(( SELECT "auth"."uid"() AS "uid"), 'smp_admin'::"text") AS "check_user_role")) WITH CHECK (( SELECT "public"."check_user_role"(( SELECT "auth"."uid"() AS "uid"), 'smp_admin'::"text") AS "check_user_role"));

ALTER TABLE "public"."smp_channelpoints_templates" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."smp_players" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."smp_triggers" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."stream_events" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."stream_viewer_counts" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."system_events" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."testimonials" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."twitch_app_token" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."twitch_clip_syncs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user can insert pending_clips" ON "public"."pending_clips" FOR INSERT WITH CHECK (("broadcaster_id" = "public"."jwt_broadcaster_id"()));

ALTER TABLE "public"."user_preferences" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select" ON "public"."users" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));

CREATE POLICY "users_update" ON "public"."users" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id"));

ALTER TABLE "public"."vods" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."widget_library_entries" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."widgets" ENABLE ROW LEVEL SECURITY;

ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

GRANT ALL ON FUNCTION "public"."add_clip_to_folder"("p_clip_id" "uuid", "p_folder_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."add_clip_to_folder"("p_clip_id" "uuid", "p_folder_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_clip_to_folder"("p_clip_id" "uuid", "p_folder_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."check_user_role"("p_user_id" "uuid", "p_role" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."create_default_commands_for_channel"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_default_commands_for_channel"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_default_commands_for_channel"() TO "service_role";

GRANT ALL ON FUNCTION "public"."create_workflow_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_workflow_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_workflow_trigger"() TO "service_role";

GRANT ALL ON FUNCTION "public"."delete_user_data"("p_twitch_user_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_user_data"("p_twitch_user_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_user_data"("p_twitch_user_id" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."get_all_clips_with_folders"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_clips_with_folders"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_clips_with_folders"() TO "service_role";

GRANT ALL ON FUNCTION "public"."get_clips_by_folder"("folder_href" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_clips_by_folder"("folder_href" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_clips_by_folder"("folder_href" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."get_stream_data"("p_video_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_stream_data"("p_video_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_stream_data"("p_video_id" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."get_user_twitch_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_twitch_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_twitch_ids"() TO "service_role";

GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";

GRANT ALL ON FUNCTION "public"."handle_new_user_integration"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user_integration"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user_integration"() TO "service_role";

GRANT ALL ON FUNCTION "public"."increment_widget_installs"("entry_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_widget_installs"("entry_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_widget_installs"("entry_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."insert_discord_integration"("integration_id" "uuid", "provider_data" "jsonb", "user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_discord_integration"("integration_id" "uuid", "provider_data" "jsonb", "user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_discord_integration"("integration_id" "uuid", "provider_data" "jsonb", "user_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."insert_integration"("p_user_id" "uuid", "p_provider_type" "public"."provider_type") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_integration"("p_user_id" "uuid", "p_provider_type" "public"."provider_type") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_integration"("p_user_id" "uuid", "p_provider_type" "public"."provider_type") TO "service_role";

GRANT ALL ON FUNCTION "public"."insert_twitch_integration"("integration_id" "uuid", "provider_data" "jsonb", "user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."insert_twitch_integration"("integration_id" "uuid", "provider_data" "jsonb", "user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_twitch_integration"("integration_id" "uuid", "provider_data" "jsonb", "user_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."jwt_broadcaster_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."jwt_broadcaster_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."jwt_broadcaster_id"() TO "service_role";

GRANT ALL ON FUNCTION "public"."remove_clip_from_folder"("p_clip_id" "uuid", "p_folder_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_clip_from_folder"("p_clip_id" "uuid", "p_folder_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_clip_from_folder"("p_clip_id" "uuid", "p_folder_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."sync_all_default_commands"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_all_default_commands"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_all_default_commands"() TO "service_role";

GRANT ALL ON FUNCTION "public"."sync_default_commands_for_channels"("target_channel_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."sync_default_commands_for_channels"("target_channel_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_default_commands_for_channels"("target_channel_id" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."update_overlay_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_overlay_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_overlay_updated_at"() TO "service_role";

GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";

GRANT ALL ON FUNCTION "public"."user_owns_channel"("channel_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."user_owns_channel"("channel_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_owns_channel"("channel_id" "text") TO "service_role";

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."broadcaster_live_status" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."broadcaster_live_status" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."broadcaster_live_status" TO "service_role";

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."clip_folder_junction" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."clip_folder_junction" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."clip_folder_junction" TO "service_role";

GRANT ALL ON SEQUENCE "public"."clip_folder_junction_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."clip_folder_junction_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."clip_folder_junction_id_seq" TO "service_role";

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."clip_folders" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."clip_folders" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."clip_folders" TO "service_role";

GRANT ALL ON SEQUENCE "public"."clip_folders_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."clip_folders_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."clip_folders_id_seq" TO "service_role";

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."clips" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."clips" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."clips" TO "service_role";

GRANT ALL ON SEQUENCE "public"."clips_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."clips_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."clips_id_seq" TO "service_role";

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."commands" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."commands" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."commands" TO "service_role";

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."custom_commands" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."custom_commands" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."custom_commands" TO "service_role";

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."default_chat_commands" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."default_chat_commands" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."default_chat_commands" TO "service_role";

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."feedback" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."feedback" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."feedback" TO "service_role";

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."integrations" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."integrations" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."integrations" TO "service_role";

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."integrations_twitch" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."integrations_twitch" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."integrations_twitch" TO "service_role";

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."irl_collector_tokens" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."irl_collector_tokens" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."irl_collector_tokens" TO "service_role";

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."irl_geo_track" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."irl_geo_track" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."irl_geo_track" TO "service_role";

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."overlay_items" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."overlay_items" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."overlay_items" TO "service_role";

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."overlay_scenes" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."overlay_scenes" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."overlay_scenes" TO "service_role";

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."overlay_widget_instances" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."overlay_widget_instances" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."overlay_widget_instances" TO "service_role";

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."pending_clips" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."pending_clips" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."pending_clips" TO "service_role";

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."smp_actions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."smp_actions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."smp_actions" TO "service_role";

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."smp_channelpoints_templates" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."smp_channelpoints_templates" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."smp_channelpoints_templates" TO "service_role";

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."smp_players" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."smp_players" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."smp_players" TO "service_role";

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."smp_triggers" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."smp_triggers" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."smp_triggers" TO "service_role";

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."stream_events" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."stream_events" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."stream_events" TO "service_role";

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."stream_viewer_counts" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."stream_viewer_counts" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."stream_viewer_counts" TO "service_role";

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."system_events" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."system_events" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."system_events" TO "service_role";

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."testimonials" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."testimonials" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."testimonials" TO "service_role";

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."twitch_app_token" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."twitch_app_token" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."twitch_app_token" TO "service_role";

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."twitch_clip_syncs" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."twitch_clip_syncs" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."twitch_clip_syncs" TO "service_role";

GRANT ALL ON SEQUENCE "public"."twitch_clip_syncs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."twitch_clip_syncs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."twitch_clip_syncs_id_seq" TO "service_role";

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_preferences" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_preferences" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_preferences" TO "service_role";

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_roles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_roles" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."user_roles" TO "service_role";

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."users" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."users" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."users" TO "service_role";

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."vods" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."vods" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."vods" TO "service_role";

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."widget_library_entries" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."widget_library_entries" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."widget_library_entries" TO "service_role";

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."widgets" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."widgets" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."widgets" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "service_role";

