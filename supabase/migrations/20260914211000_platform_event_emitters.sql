-- Platform event emitters (SW-334, SW-353). Wires the SQL-side sources into
-- emit_platform_event:
--   user.created      handle_new_user
--   discord.linked    trigger on integrations_discord (link RPC and signup)
--   discord.unlinked  trigger on integrations_discord (unlink server action)
-- user.deleted is emitted by delete_user_data (20260915120000). Subscription
-- and dashboard events are emitted from web-admin in TypeScript.

-- user.created: same insert as init.sql, plus the event once the row exists.
CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET search_path = 'public'
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

    -- Twitch fields come straight from the OAuth metadata: the integration
    -- row is written by a second trigger that runs after this one.
    PERFORM public.emit_platform_event(
        'user.created',
        NEW.id,
        NULL,
        CASE WHEN NEW.raw_app_meta_data->>'provider' = 'twitch' THEN
            jsonb_build_object(
                'twitch_username', NEW.raw_user_meta_data->>'nickname',
                'twitch_user_id', NEW.raw_user_meta_data->>'provider_id',
                'avatar_url', NEW.raw_user_meta_data->>'avatar_url'
            )
        ELSE '{}'::jsonb END
    );

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE LOG 'Error in handle_new_user: %', SQLERRM;
        RETURN NEW;
END;
$$;

-- discord.linked / discord.unlinked. One trigger covers every path that
-- writes the row: link_discord_integration, the signup trigger and the
-- unlink server action's delete. Re-linking the same Discord account (a
-- refreshed OAuth grant) updates the row without changing the id, and logs
-- nothing. delete_user_data sets streamwizard.suppress_discord_unlink_event
-- so an account deletion logs user.deleted only.
CREATE OR REPLACE FUNCTION public.log_discord_integration_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_row public.integrations_discord;
  v_identity jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row := OLD;
    IF current_setting('streamwizard.suppress_discord_unlink_event', true) = 'on' THEN
      RETURN OLD;
    END IF;
  ELSE
    v_row := NEW;
    IF TG_OP = 'UPDATE' AND OLD.discord_user_id IS NOT DISTINCT FROM NEW.discord_user_id THEN
      RETURN NEW;
    END IF;
  END IF;

  -- The Discord fields come from the row: on DELETE it's gone for the identity
  -- lookup, on INSERT it may not be visible yet. The Discord avatar is the
  -- fallback when there's no Twitch picture.
  v_identity := public.platform_event_identity(v_row.user_id);
  v_identity := v_identity || jsonb_strip_nulls(jsonb_build_object(
    'discord_user_id', v_row.discord_user_id,
    'avatar_url', COALESCE(v_identity->>'avatar_url', v_row.avatar)
  ));

  IF TG_OP = 'DELETE' THEN
    PERFORM public.emit_platform_event('discord.unlinked', v_row.user_id, NULL, v_identity);
    RETURN OLD;
  END IF;

  PERFORM public.emit_platform_event(
    'discord.linked', v_row.user_id, NULL,
    v_identity || jsonb_strip_nulls(jsonb_build_object(
      'discord_username', v_row.discord_username,
      'previous_discord_user_id', CASE WHEN TG_OP = 'UPDATE' THEN OLD.discord_user_id END
    ))
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in log_discord_integration_change: %', SQLERRM;
    RETURN COALESCE(NEW, OLD);
END;
$$;

ALTER FUNCTION public.log_discord_integration_change() OWNER TO "postgres";
REVOKE ALL ON FUNCTION public.log_discord_integration_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER "on_integrations_discord_change"
  AFTER INSERT OR UPDATE OR DELETE ON public.integrations_discord
  FOR EACH ROW EXECUTE FUNCTION public.log_discord_integration_change();
