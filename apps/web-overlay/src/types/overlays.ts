import type { Database } from "@repo/supabase/types/supabase";

/** Supabase overlay scene / item rows (do not export from `"use server"` files — Turbopack action bridge). */
export type OverlaySceneRow = Database["public"]["Tables"]["overlay_scenes"]["Row"];
export type OverlayItemRow = Database["public"]["Tables"]["overlay_items"]["Row"];
