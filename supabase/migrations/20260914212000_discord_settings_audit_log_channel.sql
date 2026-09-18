-- Log channel settings (SW-334, SW-355) are a dashboard section too, with a
-- "send test event" action.
ALTER TABLE "public"."discord_settings_audit"
    DROP CONSTRAINT "discord_settings_audit_section_check",
    ADD CONSTRAINT "discord_settings_audit_section_check"
        CHECK ("section" IN ('welcome', 'activity', 'tickets', 'permissions', 'logs')),
    DROP CONSTRAINT "discord_settings_audit_action_check",
    ADD CONSTRAINT "discord_settings_audit_action_check"
        CHECK ("action" IN ('update', 'repost_panel', 'test_welcome', 'test_log'));
