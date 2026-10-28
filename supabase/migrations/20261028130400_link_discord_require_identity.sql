-- link_discord_integration stored whatever Discord user id the caller passed,
-- and authenticated also held UPDATE on integrations_discord. Either way a
-- signed-in user could bind any not-yet-linked Discord account to their own
-- StreamWizard account without the Discord OAuth round trip (and with it the
-- Discord roles and ticket identity that follow the link).
--
-- The RPC now requires the id to be one of the caller's own Discord identities
-- in auth.identities, which GoTrue only writes after a completed OAuth flow.
-- The Discord callback route passes exactly that identity's provider_id, so
-- the real flow is unchanged. Writes to integrations_discord with a user JWT
-- are down to the unlink DELETE.
--
-- From the latest definition (20260618000001_link_discord_integration.sql),
-- plus the identity check and a pinned search_path.

CREATE OR REPLACE FUNCTION public.link_discord_integration(
    p_discord_user_id text,
    p_discord_username text,
    p_avatar text,
    p_email text
) RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM auth.identities
        WHERE user_id = v_user_id
          AND provider = 'discord'
          AND provider_id = p_discord_user_id
    ) THEN
        RAISE EXCEPTION 'Discord account is not linked to this user' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public.integrations (user_id) VALUES (v_user_id) ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.integrations_discord (user_id, discord_user_id, discord_username, avatar, email)
    VALUES (v_user_id, p_discord_user_id, p_discord_username, p_avatar, p_email)
    ON CONFLICT (user_id) DO UPDATE SET
        discord_user_id = EXCLUDED.discord_user_id,
        discord_username = EXCLUDED.discord_username,
        avatar = EXCLUDED.avatar,
        email = EXCLUDED.email;
END;
$$;

REVOKE ALL ON FUNCTION public.link_discord_integration(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_discord_integration(text, text, text, text) TO authenticated, service_role;

REVOKE UPDATE ON TABLE public.integrations_discord FROM authenticated;
