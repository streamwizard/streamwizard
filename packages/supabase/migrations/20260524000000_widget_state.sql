-- Adds runtime widget state storage, separate from field_values (which are user-configured settings).
-- Widget JS writes to this via /api/widgets/state; it persists across browser refreshes.

ALTER TABLE overlay_widget_instances
  ADD COLUMN widget_state jsonb NOT NULL DEFAULT '{}';
