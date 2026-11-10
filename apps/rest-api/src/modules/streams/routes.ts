import { Hono } from "hono";
import { supabaseAuth } from "@/middleware/auth";
import { syncClipsHandler, syncStatusHandler } from "@/routes/clips-sync";

// /api/clips: clip sync for the signed-in user. Mounted after the "/api/*"
// CORS and Supabase middleware in app.ts.
export const clipSyncRoutes = new Hono();

// Clips Sync - Trigger a sync for authenticated user
clipSyncRoutes.post("/sync", supabaseAuth(), syncClipsHandler);

// Clips Sync Status - Get sync status for authenticated user
clipSyncRoutes.get("/sync-status", supabaseAuth(), syncStatusHandler);
