-- The ingest node a session was opened on. rest-api fills it from the
-- calling node's API key, so a node can only end, and write stats for,
-- sessions it opened. Nullable for sessions opened before this column.
-- A deleted node keeps its session history (SET NULL).
ALTER TABLE "public"."ingest_sessions"
    ADD COLUMN "node_id" uuid
        REFERENCES "public"."ingest_nodes"("id") ON DELETE SET NULL;

-- Node-scoped lookups: WHERE id = $1 AND node_id = $2, and the stats batch's
-- WHERE id IN (...) AND node_id = $2.
CREATE INDEX "ingest_sessions_id_node_id_idx" ON "public"."ingest_sessions" ("id", "node_id");
-- Backs the foreign key (node deletes).
CREATE INDEX "ingest_sessions_node_id_idx" ON "public"."ingest_sessions" ("node_id") WHERE "node_id" IS NOT NULL;
