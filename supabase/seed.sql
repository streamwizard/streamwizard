-- ============================================================
-- StreamWizard — Local Development Seed
-- Runs automatically after migrations on: supabase db reset
-- ============================================================

-- Users are created automatically on first Twitch OAuth login.
-- Only global, non-user-bound data is seeded here.

-- ── Default Chat Commands ─────────────────────────────────────
INSERT INTO public.default_chat_commands (command, message, action) VALUES
  ('!discord',   'Join our Discord: https://discord.streamwizard.org', 'none'),
  ('!commands',  'Check out all available commands at streamwizard.org/commands', 'none'),
  ('!clip',      'Clip created! Check the clips section on your dashboard.', 'none'),
  ('!uptime',    'The stream has been live for {uptime}.', 'none'),
  ('!followage', '{user} has been following for {followage}.', 'none')
ON CONFLICT DO NOTHING;
