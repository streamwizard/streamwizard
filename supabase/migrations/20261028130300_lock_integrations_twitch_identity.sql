-- integrations_twitch.twitch_user_id is the channel-ownership anchor: RLS and
-- every service map a broadcaster id to a StreamWizard user through it. The
-- row owner could rewrite it through PostgREST (table-wide UPDATE grant,
-- owner-only policy), so a signed-in user could claim a streamer who had not
-- signed up yet. When that streamer later signed up, the unique violation was
-- swallowed by the signup trigger and they silently got no integration.
--
-- 1. authenticated may only update the columns the Twitch OAuth callback
--    writes with the user's session: the six token columns
--    (updateTwitchTokens) and the scope columns (setTwitchScopesByUserId).
--    Everything else, twitch_user_id and user_id included, is service role or
--    SECURITY DEFINER only.
-- 2. The signup trigger still lets the signup through when the Twitch id is
--    already taken (failing it would lock a real streamer out), but it now
--    posts a user.twitch_conflict platform event so an admin sees it.

REVOKE UPDATE ON TABLE public.integrations_twitch FROM authenticated;
GRANT UPDATE (
  access_token_ciphertext, access_token_iv, access_token_tag,
  refresh_token_ciphertext, refresh_token_iv, refresh_token_tag,
  twitch_scopes, scopes_synced_at
) ON TABLE public.integrations_twitch TO authenticated;

-- From the latest definition (20260618000000_restructure_integrations.sql),
-- with a unique_violation branch ahead of the catch-all.
CREATE OR REPLACE FUNCTION public.handle_new_user_integration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    provider_type_value public.provider_type;
    raw_provider_type TEXT;
    v_twitch_user_id TEXT;
    v_existing_user_id uuid;
BEGIN
    raw_provider_type := NEW.raw_app_meta_data->>'provider';

    BEGIN
        provider_type_value := raw_provider_type::public.provider_type;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING 'Unsupported provider type: %. Must be a valid provider_type ENUM value.', raw_provider_type;
            RETURN NEW;
    END;

    RAISE LOG 'Processing integration for provider type: %', provider_type_value;

    PERFORM public.insert_integration(NEW.id);

    CASE provider_type_value
        WHEN 'twitch' THEN
            PERFORM public.insert_twitch_integration(NEW.id, NEW.raw_user_meta_data);
        WHEN 'discord' THEN
            PERFORM public.insert_discord_integration(NEW.id, NEW.raw_user_meta_data);
    END CASE;

    RETURN NEW;

EXCEPTION
    WHEN unique_violation THEN
        -- Another account already holds this Twitch id. Don't block the
        -- signup, but don't hide it either.
        v_twitch_user_id := NEW.raw_user_meta_data->>'provider_id';
        IF provider_type_value = 'twitch' AND v_twitch_user_id IS NOT NULL THEN
            SELECT user_id INTO v_existing_user_id
            FROM public.integrations_twitch
            WHERE twitch_user_id = v_twitch_user_id;

            PERFORM public.emit_platform_event(
                'user.twitch_conflict',
                NEW.id,
                NULL,
                jsonb_build_object(
                    'twitch_username', NEW.raw_user_meta_data->>'nickname',
                    'twitch_user_id', v_twitch_user_id,
                    'avatar_url', NEW.raw_user_meta_data->>'avatar_url',
                    'existing_user_id', v_existing_user_id
                )
            );
        END IF;
        RAISE WARNING 'Error in handle_new_user_integration: %', SQLERRM;
        RETURN NEW;
    WHEN OTHERS THEN
        RAISE WARNING 'Error in handle_new_user_integration: %', SQLERRM;
        RETURN NEW;
END;
$$;
