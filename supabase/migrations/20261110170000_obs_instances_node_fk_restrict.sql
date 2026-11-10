-- Deleting an OBS node must not delete the instances on it. With ON DELETE
-- CASCADE a node delete in web-admin silently removed every user's instance
-- row (their S3 config stayed behind, orphaned). RESTRICT makes the delete
-- fail with 23503, which deleteNode() already turns into "This node still has
-- instances or sessions. Remove those first."
ALTER TABLE "public"."obs_instances"
    DROP CONSTRAINT "obs_instances_node_id_fkey",
    ADD CONSTRAINT "obs_instances_node_id_fkey"
        FOREIGN KEY ("node_id") REFERENCES "public"."obs_nodes"("id") ON DELETE RESTRICT;
