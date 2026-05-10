-- Optional: remove normalized table if a previous iteration was applied.
DROP TABLE IF EXISTS overlay_clip_display_fields;

-- Display fields as normal overlay_items rows, linked via config.parentClipItemId.
-- Migrate legacy embedded display* keys on clips_widget into child items, then strip parent json.

WITH field_keys AS (
  SELECT unnest(ARRAY['title','creator','game','date','viewCount','duration']) AS field_key
)
INSERT INTO overlay_items (
  scene_id,
  type,
  x,
  y,
  w,
  h,
  z_index,
  rotation,
  opacity,
  is_visible,
  is_locked,
  label,
  config
)
SELECT
  oi.scene_id,
  'clip_display_field',
  oi.x,
  oi.y,
  oi.w,
  oi.h,
  oi.z_index,
  oi.rotation,
  1.0,
  COALESCE((oi.config->'displayFields'->>fk.field_key)::boolean, true),
  false,
  'Display · ' || fk.field_key,
  jsonb_build_object(
    'parentClipItemId', oi.id::text,
    'fieldKey', fk.field_key,
    'stackOrder', COALESCE(
      (
        SELECT (t.ord - 1)::integer
        FROM jsonb_array_elements_text(
          COALESCE(oi.config->'displayFieldOrder', '[]'::jsonb)
        ) WITH ORDINALITY AS t(key, ord)
        WHERE t.key = fk.field_key
        LIMIT 1
      ),
      CASE fk.field_key
        WHEN 'title' THEN 0
        WHEN 'creator' THEN 1
        WHEN 'game' THEN 2
        WHEN 'date' THEN 3
        WHEN 'viewCount' THEN 4
        WHEN 'duration' THEN 5
      END
    ),
    'layout', jsonb_build_object(
      'x', COALESCE((oi.config#>>ARRAY['displayFieldLayouts', fk.field_key, 'x'])::real, 0),
      'y', COALESCE((oi.config#>>ARRAY['displayFieldLayouts', fk.field_key, 'y'])::real, 0),
      'w', COALESCE((oi.config#>>ARRAY['displayFieldLayouts', fk.field_key, 'w'])::real, 30),
      'h', COALESCE((oi.config#>>ARRAY['displayFieldLayouts', fk.field_key, 'h'])::real, 10),
      'fontSize', COALESCE((oi.config#>>ARRAY['displayFieldLayouts', fk.field_key, 'fontSize'])::integer, 14)
    ),
    'isLayoutLocked', COALESCE((oi.config->'displayFieldLocks'->>fk.field_key)::boolean, false)
  )
FROM overlay_items oi
CROSS JOIN field_keys fk
WHERE oi.type = 'clips_widget'
  AND (oi.config ? 'displayFields');

-- Slim parent json (remove embedded field state; children are source of truth)
UPDATE overlay_items
SET config = config
  - 'displayFields'
  - 'displayFieldLayouts'
  - 'displayFieldLocks'
  - 'displayFieldOrder'
WHERE type = 'clips_widget';
