CREATE TABLE overlay_scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  width integer NOT NULL DEFAULT 1920,
  height integer NOT NULL DEFAULT 1080,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, slug)
);

CREATE TABLE overlay_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id uuid NOT NULL REFERENCES overlay_scenes(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'clips_widget',
  x real NOT NULL DEFAULT 0,
  y real NOT NULL DEFAULT 0,
  w real NOT NULL DEFAULT 400,
  h real NOT NULL DEFAULT 300,
  z_index integer NOT NULL DEFAULT 0,
  rotation real NOT NULL DEFAULT 0,
  opacity real NOT NULL DEFAULT 1,
  is_visible boolean NOT NULL DEFAULT true,
  is_locked boolean NOT NULL DEFAULT false,
  label text NOT NULL DEFAULT 'Untitled',
  config jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_overlay_scenes_user_id ON overlay_scenes(user_id);
CREATE INDEX idx_overlay_scenes_slug ON overlay_scenes(slug);
CREATE INDEX idx_overlay_items_scene_id ON overlay_items(scene_id);

-- RLS
ALTER TABLE overlay_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE overlay_items ENABLE ROW LEVEL SECURITY;

-- Owner policies for overlay_scenes
CREATE POLICY "Users can view own scenes" ON overlay_scenes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scenes" ON overlay_scenes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scenes" ON overlay_scenes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scenes" ON overlay_scenes
  FOR DELETE USING (auth.uid() = user_id);

-- Owner policies for overlay_items (through scene ownership)
CREATE POLICY "Users can view items of own scenes" ON overlay_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM overlay_scenes
      WHERE overlay_scenes.id = overlay_items.scene_id
        AND overlay_scenes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert items to own scenes" ON overlay_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM overlay_scenes
      WHERE overlay_scenes.id = overlay_items.scene_id
        AND overlay_scenes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update items of own scenes" ON overlay_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM overlay_scenes
      WHERE overlay_scenes.id = overlay_items.scene_id
        AND overlay_scenes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete items of own scenes" ON overlay_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM overlay_scenes
      WHERE overlay_scenes.id = overlay_items.scene_id
        AND overlay_scenes.user_id = auth.uid()
    )
  );

-- Public read for active overlays (renderer subdomain)
CREATE POLICY "Public can read active scenes by slug" ON overlay_scenes
  FOR SELECT USING (is_active = true);

CREATE POLICY "Public can read items of active scenes" ON overlay_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM overlay_scenes
      WHERE overlay_scenes.id = overlay_items.scene_id
        AND overlay_scenes.is_active = true
    )
  );

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_overlay_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_overlay_scenes_updated_at
  BEFORE UPDATE ON overlay_scenes
  FOR EACH ROW
  EXECUTE FUNCTION update_overlay_updated_at();

CREATE TRIGGER set_overlay_items_updated_at
  BEFORE UPDATE ON overlay_items
  FOR EACH ROW
  EXECUTE FUNCTION update_overlay_updated_at();
