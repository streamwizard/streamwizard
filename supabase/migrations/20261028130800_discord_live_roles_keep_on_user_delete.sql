-- discord_live_roles is the ledger of who holds the Discord live role. Its
-- user_id cascaded on account deletion, so deleting a live streamer's account
-- removed the row and reconcileLiveRoles never saw a grant to take back: the
-- Discord member kept the live role for good.
--
-- With ON DELETE SET NULL the row stays, it no longer matches anyone in the
-- wanted set, and the next sweep (boot, then every 10 minutes) removes the
-- role and deletes the row. user_id is already nullable.

ALTER TABLE public.discord_live_roles DROP CONSTRAINT discord_live_roles_user_id_fkey;
ALTER TABLE public.discord_live_roles
  ADD CONSTRAINT discord_live_roles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
