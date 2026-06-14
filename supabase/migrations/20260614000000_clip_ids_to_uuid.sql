-- Migrate clip-related primary keys from integer/bigint to uuid.
--
-- Tables affected (id column keeps its exact name, becomes uuid):
--   - clips                (bigint identity)
--   - clip_folders         (bigint identity)   <- the hub: referenced by FKs + JSON
--   - clip_folder_junction (bigint identity)
--   - twitch_clip_syncs    (integer serial)
--
-- The remap is dynamic: new uuids are generated per row and old->new mappings are
-- derived from the live data via joins, so this works against any data set.
--
-- Relationships preserved (no data loss):
--   * clip_folder_junction.folder_id   -> clip_folders.id   (ON DELETE CASCADE)
--   * clip_folders.parent_folder_id    -> clip_folders.id   (self-ref)
--   * overlay_items.config->'folderIds' JSON arrays (numeric folder ids -> uuid strings)
--
-- Note: the clip<->junction link is via text (clips.twitch_clip_id = clip_folder_junction.clip_id),
-- NOT via clips.id, so changing clips.id does not touch that relationship.
--
-- Migrations run in a single transaction => all-or-nothing.

-- ---------------------------------------------------------------------------
-- 1. Add new uuid columns and backfill mappings (nothing destructive yet)
-- ---------------------------------------------------------------------------

-- clip_folders: new id + remapped self-referential parent
ALTER TABLE "public"."clip_folders"
    ADD COLUMN "id_new" uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "public"."clip_folders"
    ADD COLUMN "parent_folder_id_new" uuid;

UPDATE "public"."clip_folders" c
SET "parent_folder_id_new" = p."id_new"
FROM "public"."clip_folders" p
WHERE c."parent_folder_id" = p."id";

-- clip_folder_junction: new id + remapped folder_id
ALTER TABLE "public"."clip_folder_junction"
    ADD COLUMN "id_new" uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "public"."clip_folder_junction"
    ADD COLUMN "folder_id_new" uuid;

UPDATE "public"."clip_folder_junction" j
SET "folder_id_new" = f."id_new"
FROM "public"."clip_folders" f
WHERE j."folder_id" = f."id";

-- clips: new id (nothing references it)
ALTER TABLE "public"."clips"
    ADD COLUMN "id_new" uuid NOT NULL DEFAULT gen_random_uuid();

-- twitch_clip_syncs: new id (nothing references it)
ALTER TABLE "public"."twitch_clip_syncs"
    ADD COLUMN "id_new" uuid NOT NULL DEFAULT gen_random_uuid();

-- ---------------------------------------------------------------------------
-- 2. Remap overlay_items.config->'folderIds' (numeric ids -> new uuid strings)
--    Order preserved; dangling ids (no matching folder) are dropped.
-- ---------------------------------------------------------------------------

UPDATE "public"."overlay_items" oi
SET "config" = jsonb_set(
    oi."config",
    '{folderIds}',
    COALESCE((
        SELECT jsonb_agg(to_jsonb(f."id_new"::text) ORDER BY e.ord)
        FROM jsonb_array_elements_text(oi."config"->'folderIds') WITH ORDINALITY AS e(val, ord)
        JOIN "public"."clip_folders" f ON f."id" = e.val::bigint
    ), '[]'::jsonb)
)
WHERE oi."config" ? 'folderIds'
  AND jsonb_typeof(oi."config"->'folderIds') = 'array'
  AND jsonb_array_length(oi."config"->'folderIds') > 0;

-- ---------------------------------------------------------------------------
-- 3. Drop foreign keys, dependent indexes and unique constraints/indexes that
--    reference the old integer columns
-- ---------------------------------------------------------------------------

-- RLS policy whose WITH CHECK references folder_id (recreated in step 6)
DROP POLICY IF EXISTS "Users can add clips to their own folders" ON "public"."clip_folder_junction";

ALTER TABLE "public"."clip_folder_junction"
    DROP CONSTRAINT IF EXISTS "clip_folder_junction_folder_id_fkey";
ALTER TABLE "public"."clip_folders"
    DROP CONSTRAINT IF EXISTS "clip_folders_parent_folder_id_fkey";

-- unique constraint on (clip_id, folder_id)
ALTER TABLE "public"."clip_folder_junction"
    DROP CONSTRAINT IF EXISTS "clip_folder_junction_clip_id_folder_id_key";

-- plain fk indexes
DROP INDEX IF EXISTS "public"."idx_clip_folder_junction_folder_id";
DROP INDEX IF EXISTS "public"."idx_clip_folders_parent_folder_id";

-- partial unique indexes whose predicate/keys use parent_folder_id
DROP INDEX IF EXISTS "public"."clip_folders_user_parent_name_key";
DROP INDEX IF EXISTS "public"."clip_folders_user_root_name_key";

-- partial index on clips.id
DROP INDEX IF EXISTS "public"."clips_is_featured_idx";

-- ---------------------------------------------------------------------------
-- 4. Drop primary keys + old columns, then rename new columns into place
-- ---------------------------------------------------------------------------

-- clip_folder_junction
ALTER TABLE "public"."clip_folder_junction" DROP CONSTRAINT "clip_folder_junction_pkey";
ALTER TABLE "public"."clip_folder_junction" DROP COLUMN "id";
ALTER TABLE "public"."clip_folder_junction" DROP COLUMN "folder_id";
ALTER TABLE "public"."clip_folder_junction" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "public"."clip_folder_junction" RENAME COLUMN "folder_id_new" TO "folder_id";
ALTER TABLE "public"."clip_folder_junction" ADD CONSTRAINT "clip_folder_junction_pkey" PRIMARY KEY ("id");

-- clip_folders
ALTER TABLE "public"."clip_folders" DROP CONSTRAINT "clip_folders_pkey";
ALTER TABLE "public"."clip_folders" DROP COLUMN "id";
ALTER TABLE "public"."clip_folders" DROP COLUMN "parent_folder_id";
ALTER TABLE "public"."clip_folders" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "public"."clip_folders" RENAME COLUMN "parent_folder_id_new" TO "parent_folder_id";
ALTER TABLE "public"."clip_folders" ADD CONSTRAINT "clip_folders_pkey" PRIMARY KEY ("id");

-- clips
ALTER TABLE "public"."clips" DROP CONSTRAINT "clips_pkey";
ALTER TABLE "public"."clips" DROP COLUMN "id";
ALTER TABLE "public"."clips" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "public"."clips" ADD CONSTRAINT "clips_pkey" PRIMARY KEY ("id");

-- twitch_clip_syncs (drop the old serial sequence too)
ALTER TABLE "public"."twitch_clip_syncs" DROP CONSTRAINT "twitch_clip_syncs_pkey";
ALTER TABLE "public"."twitch_clip_syncs" DROP COLUMN "id";
ALTER TABLE "public"."twitch_clip_syncs" RENAME COLUMN "id_new" TO "id";
ALTER TABLE "public"."twitch_clip_syncs" ADD CONSTRAINT "twitch_clip_syncs_pkey" PRIMARY KEY ("id");
DROP SEQUENCE IF EXISTS "public"."twitch_clip_syncs_id_seq";

-- ---------------------------------------------------------------------------
-- 5. Recreate foreign keys (same names + behavior) on the new uuid columns
-- ---------------------------------------------------------------------------

ALTER TABLE "public"."clip_folder_junction"
    ADD CONSTRAINT "clip_folder_junction_folder_id_fkey"
    FOREIGN KEY ("folder_id") REFERENCES "public"."clip_folders"("id") ON DELETE CASCADE;

ALTER TABLE "public"."clip_folders"
    ADD CONSTRAINT "clip_folders_parent_folder_id_fkey"
    FOREIGN KEY ("parent_folder_id") REFERENCES "public"."clip_folders"("id");

-- ---------------------------------------------------------------------------
-- 6. Recreate indexes and unique constraints
-- ---------------------------------------------------------------------------

-- unique (clip_id, folder_id)
ALTER TABLE "public"."clip_folder_junction"
    ADD CONSTRAINT "clip_folder_junction_clip_id_folder_id_key" UNIQUE ("clip_id", "folder_id");

-- fk indexes
CREATE INDEX IF NOT EXISTS "idx_clip_folder_junction_folder_id"
    ON "public"."clip_folder_junction" ("folder_id");
CREATE INDEX IF NOT EXISTS "idx_clip_folders_parent_folder_id"
    ON "public"."clip_folders" ("parent_folder_id");

-- partial unique indexes for sibling folder-name uniqueness
-- (mirrors 20260611100000_clip_folders_unique_sibling_name.sql)
CREATE UNIQUE INDEX IF NOT EXISTS "clip_folders_user_parent_name_key"
    ON "public"."clip_folders" ("user_id", "parent_folder_id", "name")
    WHERE "parent_folder_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "clip_folders_user_root_name_key"
    ON "public"."clip_folders" ("user_id", "name")
    WHERE "parent_folder_id" IS NULL;

-- partial index for featured-only filter
-- (mirrors 20260611094041_clips_search_indexes.sql)
CREATE INDEX IF NOT EXISTS "clips_is_featured_idx"
    ON "public"."clips" ("id") WHERE "is_featured" = true;

-- Recreate the INSERT policy dropped in step 3 (final perf-wrapped definition,
-- mirrors init + 20260611034332_perf_rls_initplan_wrap_auth_calls.sql).
CREATE POLICY "Users can add clips to their own folders" ON "public"."clip_folder_junction"
    FOR INSERT TO "authenticated"
    WITH CHECK (
        ((( SELECT auth.uid()) = user_id)
        AND (EXISTS ( SELECT 1 FROM clips WHERE (clips.twitch_clip_id = clip_folder_junction.clip_id)))
        AND (EXISTS ( SELECT 1 FROM clip_folders WHERE ((clip_folders.id = clip_folder_junction.folder_id) AND (clip_folders.user_id = ( SELECT auth.uid()))))))
    );

-- ---------------------------------------------------------------------------
-- 7. Update functions whose return type exposed the old bigint clip id.
--    The return type changes (id bigint -> uuid), so the functions must be
--    DROPped and recreated (CREATE OR REPLACE cannot change return type).
--    Bodies are unchanged; folders' jsonb 'id' now carries uuid values.
--    search_path is re-specified (set by 20260611032439_fix_security_advisors.sql)
--    and grants are re-applied (init.sql) because DROP removes them.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS "public"."get_all_clips_with_folders"();
DROP FUNCTION IF EXISTS "public"."get_clips_by_folder"("folder_href" "text");

CREATE FUNCTION "public"."get_all_clips_with_folders"() RETURNS TABLE("id" uuid, "title" "text", "twitch_clip_id" "text", "creator_name" "text", "game_name" "text", "url" "text", "thumbnail_url" "text", "created_at" timestamp with time zone, "view_count" integer, "duration" numeric, "broadcaster_name" "text", "created_at_twitch" timestamp with time zone, "user_id" "uuid", "embed_url" "text", "broadcaster_id" "text", "creator_id" "text", "video_id" "text", "game_id" "text", "language" "text", "vod_offset" integer, "is_featured" boolean, "folders" "jsonb")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.title,
        c.twitch_clip_id,
        c.creator_name,
        c.game_name,
        c.url,
        c.thumbnail_url,
        c.created_at,
        c.view_count,
        c.duration,
        c.broadcaster_name,
        c.created_at_twitch,
        c.user_id,
        c.embed_url,
        c.broadcaster_id,
        c.creator_id,
        c.video_id,
        c.game_id,
        c.language,
        c.vod_offset,
        c.is_featured,
        COALESCE(
            JSONB_AGG(DISTINCT jsonb_build_object(
                'id', cf.id,
                'name', cf.name,
                'href', cf.href
            )) FILTER (WHERE cf.id IS NOT NULL),
            '[]'::jsonb
        ) AS folders
    FROM
        public.clips c
    LEFT JOIN
        public.clip_folder_junction cfj ON c.twitch_clip_id = cfj.clip_id
    LEFT JOIN
        public.clip_folders cf ON cfj.folder_id = cf.id
    GROUP BY
        c.id;
END;
$$;

CREATE FUNCTION "public"."get_clips_by_folder"("folder_href" "text") RETURNS TABLE("id" uuid, "title" "text", "twitch_clip_id" "text", "creator_name" "text", "game_name" "text", "url" "text", "thumbnail_url" "text", "created_at" timestamp with time zone, "view_count" integer, "duration" numeric, "broadcaster_name" "text", "created_at_twitch" timestamp with time zone, "user_id" "uuid", "embed_url" "text", "broadcaster_id" "text", "creator_id" "text", "video_id" "text", "game_id" "text", "language" "text", "vod_offset" integer, "is_featured" boolean, "folders" "jsonb")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.title,
        c.twitch_clip_id,
        c.creator_name,
        c.game_name,
        c.url,
        c.thumbnail_url,
        c.created_at,
        c.view_count,
        c.duration,
        c.broadcaster_name,
        c.created_at_twitch,
        c.user_id,
        c.embed_url,
        c.broadcaster_id,
        c.creator_id,
        c.video_id,
        c.game_id,
        c.language,
        c.vod_offset,
        c.is_featured,
        JSONB_AGG(DISTINCT jsonb_build_object('id', cf.id, 'name', cf.name, 'href', cf.href)) AS folders
    FROM
        public.clips c
    JOIN
        public.clip_folder_junction cfj ON c.twitch_clip_id = cfj.clip_id
    JOIN
        public.clip_folders cf ON cfj.folder_id = cf.id
    WHERE
        c.twitch_clip_id IN (
            SELECT
                c_sub.twitch_clip_id
            FROM
                public.clips c_sub
            JOIN
                public.clip_folder_junction cfj_sub ON c_sub.twitch_clip_id = cfj_sub.clip_id
            JOIN
                public.clip_folders cf_sub ON cfj_sub.folder_id = cf_sub.id
            WHERE
                cf_sub.href = folder_href
        )
    GROUP BY
        c.id, c.title, c.twitch_clip_id, c.creator_name, c.game_name,
        c.url, c.thumbnail_url, c.created_at, c.view_count, c.duration,
        c.broadcaster_name, c.created_at_twitch, c.user_id, c.embed_url,
        c.broadcaster_id, c.creator_id, c.video_id, c.game_id, c.language,
        c.vod_offset, c.is_featured;
END;
$$;

-- Re-apply ownership + grants removed by DROP FUNCTION (mirrors init.sql).
ALTER FUNCTION "public"."get_all_clips_with_folders"() OWNER TO "postgres";
ALTER FUNCTION "public"."get_clips_by_folder"("folder_href" "text") OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."get_all_clips_with_folders"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_clips_with_folders"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_clips_with_folders"() TO "service_role";

GRANT ALL ON FUNCTION "public"."get_clips_by_folder"("folder_href" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_clips_by_folder"("folder_href" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_clips_by_folder"("folder_href" "text") TO "service_role";
