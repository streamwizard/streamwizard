-- Performance: add covering indexes for foreign keys that had none.
-- Speeds up joins and FK cascade/constraint checks; the user_id/broadcaster_id
-- ones also back the RLS ownership filters. Fixes advisor 0001_unindexed_foreign_keys.
-- (Plain CREATE INDEX runs inside the migration txn. For very large prod tables,
--  consider running these CONCURRENTLY out-of-band instead.)

CREATE INDEX IF NOT EXISTS idx_clips_video_id                          ON public.clips (video_id);
CREATE INDEX IF NOT EXISTS idx_commands_channel_id                     ON public.commands (channel_id);
CREATE INDEX IF NOT EXISTS idx_commands_custom_command_id              ON public.commands (custom_command_id);
CREATE INDEX IF NOT EXISTS idx_commands_default_command_id             ON public.commands (default_command_id);
CREATE INDEX IF NOT EXISTS idx_integrations_twitch_user_id             ON public.integrations_twitch (user_id);
CREATE INDEX IF NOT EXISTS idx_irl_collector_tokens_user_id            ON public.irl_collector_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_overlay_widget_instances_overlay_item_id ON public.overlay_widget_instances (overlay_item_id);
CREATE INDEX IF NOT EXISTS idx_overlay_widget_instances_user_id        ON public.overlay_widget_instances (user_id);
CREATE INDEX IF NOT EXISTS idx_overlay_widget_instances_widget_id      ON public.overlay_widget_instances (widget_id);
CREATE INDEX IF NOT EXISTS idx_smp_channelpoints_templates_action      ON public.smp_channelpoints_templates (action);
CREATE INDEX IF NOT EXISTS idx_smp_players_broadcaster_id              ON public.smp_players (broadcaster_id);
CREATE INDEX IF NOT EXISTS idx_smp_triggers_action_id                 ON public.smp_triggers (action_id);
CREATE INDEX IF NOT EXISTS idx_stream_events_stream_id                 ON public.stream_events (stream_id);
CREATE INDEX IF NOT EXISTS idx_testimonials_user_id                   ON public.testimonials (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id                     ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_vods_broadcaster_id                    ON public.vods (broadcaster_id);
CREATE INDEX IF NOT EXISTS idx_widget_library_entries_user_id         ON public.widget_library_entries (user_id);
CREATE INDEX IF NOT EXISTS idx_widget_library_entries_widget_id       ON public.widget_library_entries (widget_id);
CREATE INDEX IF NOT EXISTS idx_widgets_user_id                        ON public.widgets (user_id);
