-- ============================================================
-- StreamWizard — Local Development Seed
-- Runs automatically after migrations on: supabase db reset
-- ============================================================

-- Fixed UUIDs so local dev is reproducible
-- Test user simulates a Twitch OAuth login (Twitch user ID: 123456789)
-- To actually authenticate locally, configure real Twitch OAuth credentials

DO $$
DECLARE
  v_user_id uuid := '00000000-0000-0000-0000-000000000001';
  v_integration_id uuid := '00000000-0000-0000-0000-000000000002';
BEGIN

  -- ── Auth user ──────────────────────────────────────────────
  -- Simulates a user created via Twitch OAuth.
  -- To actually log in locally you still need real Twitch OAuth credentials.
  -- This record exists so FK constraints are satisfied for local DB development.
  INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    role,
    aud
  ) VALUES (
    v_user_id,
    'test@streamwizard.local',
    '',
    now(),
    '{"provider":"twitch","providers":["twitch"]}',
    '{"name":"Test Broadcaster","avatar_url":"https://static-cdn.jtvnw.net/user-default-pictures-uv/75305d54-c7cc-40d1-bb9c-91fbe85943c7-profile_image-70x70.png","provider_id":"123456789"}',
    now(),
    now(),
    'authenticated',
    'authenticated'
  ) ON CONFLICT (id) DO NOTHING;

  -- ── Public user record ─────────────────────────────────────
  INSERT INTO public.users (id, email, name, avatar_url, role)
  VALUES (
    v_user_id,
    'test@streamwizard.local',
    'Test Broadcaster',
    'https://static-cdn.jtvnw.net/user-default-pictures-uv/75305d54-c7cc-40d1-bb9c-91fbe85943c7-profile_image-70x70.png',
    'user'
  ) ON CONFLICT (id) DO NOTHING;

  -- ── User role ──────────────────────────────────────────────
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_user_id, 'default_user')
  ON CONFLICT DO NOTHING;

  -- ── Twitch integration ─────────────────────────────────────
  -- Uses a fake Twitch user ID — sufficient for local UI dev
  -- Real Twitch OAuth will not work with these values
  INSERT INTO public.integrations (id, user_id, type, is_active)
  VALUES (v_integration_id, v_user_id, 'twitch', true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.integrations_twitch (
    id,
    user_id,
    twitch_username,
    twitch_user_id,
    broadcaster_type,
    description
  ) VALUES (
    v_integration_id,
    v_user_id,
    'testbroadcaster',
    '123456789',
    'affiliate',
    'Local dev test broadcaster'
  ) ON CONFLICT (id) DO NOTHING;

END $$;
