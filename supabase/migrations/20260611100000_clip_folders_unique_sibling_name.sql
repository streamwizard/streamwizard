-- Enforce unique folder names among siblings.
--
-- Folder hrefs are derived from name + parent path, so two folders sharing a
-- name under the same parent collide on href and make one unreachable. This
-- mirrors the app-level guard in queries/clips.ts at the database level.
--
-- A plain UNIQUE (user_id, parent_folder_id, name) would NOT cover root folders,
-- because Postgres treats NULL parent_folder_id values as distinct. We therefore
-- use two partial unique indexes: one for nested folders, one for root folders.

CREATE UNIQUE INDEX IF NOT EXISTS "clip_folders_user_parent_name_key"
    ON "public"."clip_folders" ("user_id", "parent_folder_id", "name")
    WHERE "parent_folder_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "clip_folders_user_root_name_key"
    ON "public"."clip_folders" ("user_id", "name")
    WHERE "parent_folder_id" IS NULL;
