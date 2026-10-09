-- Read-only views for the PostHog data warehouse.
--
-- Some questions are about what exists, not about what someone did: how many
-- files a user has uploaded, how many clips sit in folders, how long ingest
-- sessions last. PostHog can answer those by syncing rows from this database
-- and joining them to events on user_id, with no new events at all.
--
-- It must never get the tables themselves. They hold overlay subscriber
-- tokens, encrypted OBS and VNC passwords, the IP an ingest session came from,
-- custom widget source code, and names and file names people typed. So the
-- warehouse reads these views instead, and each view lists the columns that
-- are safe to leave the database: ids, types, sizes, states and timestamps.
-- Adding a column to a table does not add it here.
--
-- The views run with the rights of their owner (security_invoker = false), on
-- purpose: the reader role has no access to the tables and no RLS policy of
-- its own, and should have neither. What it can see is exactly what a view
-- selects. The schema is not in the API's exposed schemas, so none of this is
-- reachable through PostgREST.

create schema if not exists analytics;

revoke all on schema analytics from public;
revoke all on schema analytics from anon, authenticated;

-- Overlays: one row per overlay. No name, slug or subscriber token.
create or replace view analytics.overlay_scenes
with (security_invoker = false) as
select id, user_id, render_mode, width, height, is_active, is_favourite, created_at, updated_at
from public.overlay_scenes;

-- Widgets placed on overlays. The config stays behind (it can hold anything a
-- user typed); the one thing taken from it is which custom widget an item is.
create or replace view analytics.overlay_items
with (security_invoker = false) as
select
  id,
  scene_id,
  type,
  is_visible,
  is_locked,
  case when type = 'custom_widget' then config ->> 'widget_id' end as custom_widget_id,
  created_at,
  updated_at
from public.overlay_items;

-- Custom widgets people built. No name, description or source.
create or replace view analytics.overlay_widgets
with (security_invoker = false) as
select id, user_id, created_at, updated_at
from public.overlay_widgets;

-- Clip folders and what is in them. No folder names.
create or replace view analytics.clip_folders
with (security_invoker = false) as
select id, user_id, parent_folder_id, created_at, updated_at
from public.clip_folders;

create or replace view analytics.clip_folder_junction
with (security_invoker = false) as
select id, folder_id, user_id, clip_id, created_at
from public.clip_folder_junction;

-- Clips per user, as a count. The clips table itself is by far the largest
-- one here and nothing asked so far needs its rows.
create or replace view analytics.clip_counts
with (security_invoker = false) as
select
  user_id,
  count(*) as clip_count,
  count(*) filter (where is_featured) as featured_clip_count,
  max(created_at) as last_synced_at
from public.clips
group by user_id;

-- Clips made in the VOD editor, while Twitch is still processing them.
create or replace view analytics.pending_clips
with (security_invoker = false) as
select id, clip_id, broadcaster_id, status, retry_count, created_at, last_checked_at
from public.pending_clips;

-- IRL ingest sessions. No remote IP and no key id.
create or replace view analytics.ingest_sessions
with (security_invoker = false) as
select
  id,
  user_id,
  protocol,
  started_at,
  ended_at,
  last_bitrate_kbps,
  extract(epoch from (ended_at - started_at))::integer as duration_seconds
from public.ingest_sessions;

-- Cloud OBS instances. No container names and none of the password columns.
create or replace view analytics.obs_instances
with (security_invoker = false) as
select
  id,
  user_id,
  node_id,
  resolution,
  status,
  config_template,
  memory_mb,
  storage_quota_mb,
  used_storage_bytes,
  created_at,
  updated_at
from public.obs_instances;

-- Media library files. No storage key and no file name.
create or replace view analytics.user_assets
with (security_invoker = false) as
select id, user_id, kind, mime_type, size_bytes, status, created_at
from public.user_assets;

-- A group role that carries the grants. It cannot log in. The login the
-- warehouse connects with is created by hand, per environment, as a member of
-- this role, so no password ever lives in a migration:
--
--   create role posthog_reader login password '...' in role analytics_reader;
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'analytics_reader') then
    create role analytics_reader nologin;
  end if;
end
$$;

grant usage on schema analytics to analytics_reader;
grant select on all tables in schema analytics to analytics_reader;
-- A view added to this schema later is readable without a second grant.
alter default privileges in schema analytics grant select on tables to analytics_reader;
