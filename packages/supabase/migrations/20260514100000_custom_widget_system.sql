-- Custom widget system: user-authored HTML/JS/Tailwind widgets with field schemas

CREATE TABLE widgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  html text NOT NULL DEFAULT '',
  js text NOT NULL DEFAULT '',
  extra_css text NOT NULL DEFAULT '',
  fields jsonb NOT NULL DEFAULT '{}',
  preview_url text,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE widgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own widgets" ON widgets
  USING (auth.uid() = user_id);

-- Public sharing layer for the community widget library
CREATE TABLE widget_library_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_id uuid NOT NULL REFERENCES widgets ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  likes int NOT NULL DEFAULT 0,
  installs int NOT NULL DEFAULT 0,
  is_approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE widget_library_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read approved entries" ON widget_library_entries
  FOR SELECT USING (is_approved = true);
-- Split into per-operation policies so users can never self-approve
CREATE POLICY "Users read own entries" ON widget_library_entries
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own entries" ON widget_library_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id AND is_approved = false);
CREATE POLICY "Users delete own entries" ON widget_library_entries
  FOR DELETE USING (auth.uid() = user_id);

-- Per-overlay-item field value overrides (merged over field schema defaults at render time)
CREATE TABLE overlay_widget_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  overlay_item_id uuid NOT NULL REFERENCES overlay_items ON DELETE CASCADE,
  widget_id uuid NOT NULL REFERENCES widgets ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users,
  field_values jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE overlay_widget_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own instances" ON overlay_widget_instances
  USING (auth.uid() = user_id);

-- Helper to safely increment the installs counter
CREATE OR REPLACE FUNCTION increment_widget_installs(entry_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE widget_library_entries SET installs = installs + 1 WHERE id = entry_id;
$$;
