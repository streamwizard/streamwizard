-- ============================================================
-- StreamWizard — Local Development Seed
-- Runs automatically after migrations on: supabase db reset
-- ============================================================

-- Users are created automatically on first Twitch OAuth login.
-- Only global, non-user-bound data is seeded here.

-- ── Default Chat Commands ─────────────────────────────────────
INSERT INTO public.default_chat_commands (command, message, action) VALUES
  ('!discord',   'Join our Discord: https://discord.gg/29Eq659egv', 'none'),
  ('!commands',  'Check out all available commands at streamwizard.org/commands', 'none'),
  ('!clip',      'Clip created! Check the clips section on your dashboard.', 'none'),
  ('!uptime',    'The stream has been live for {uptime}.', 'none'),
  ('!followage', '{user} has been following for {followage}.', 'none')
ON CONFLICT DO NOTHING;

-- ── SMP Actions ───────────────────────────────────────────────
INSERT INTO public.smp_actions (name, description, action) VALUES
  ('Give Item',     'Give an item to a Minecraft player',       'give_item'),
  ('Teleport',      'Teleport a player to a location',          'teleport'),
  ('Set Time',      'Change the in-game time',                  'set_time'),
  ('Set Weather',   'Change the in-game weather',               'set_weather'),
  ('Send Message',  'Send a message in Minecraft chat',         'send_message'),
  ('Play Effect',   'Trigger a particle or sound effect',       'play_effect')
ON CONFLICT DO NOTHING;

-- ── SMP Channel Points Templates ─────────────────────────────
INSERT INTO public.smp_channelpoints_templates (title, cost, prompt, is_enabled, is_user_input_required) VALUES
  ('Random Item Drop',      500,  'Type a Minecraft item name',  true, true),
  ('Teleport to Streamer',  1000, NULL,                          true, false),
  ('Change Weather',        250,  'sunny or rain?',              true, true),
  ('Send Chat Message',     100,  'Your message (keep it nice)', true, true)
ON CONFLICT DO NOTHING;
