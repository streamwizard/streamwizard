-- Safe, read-only list of ingest servers for client apps (mobile IRL app).
--
-- `ingest_nodes` is admin-only (RLS restricts it to admins), and it holds secrets
-- (control_secret_*, claim_token_hash) plus internal addresses (lan_ip, tailscale_ip).
-- This view exposes ONLY the public connection info encoders already use — the
-- server name and the public host — for `linked` nodes, to authenticated users.
--
-- security_invoker = off: the view runs with its owner's (postgres) privileges, so
-- it bypasses the underlying admin-only RLS and returns exactly the safe subset
-- selected here. No secrets or internal fields are reachable through it.
CREATE OR REPLACE VIEW "public"."ingest_servers"
    WITH (security_invoker = off) AS
SELECT
    "id",
    "name",
    COALESCE("public_hostname", "public_ip") AS "host",
    8888 AS "srt_port",
    5000 AS "srtla_port"
FROM "public"."ingest_nodes"
WHERE "status" = 'linked'
  AND COALESCE("public_hostname", "public_ip") IS NOT NULL;

ALTER VIEW "public"."ingest_servers" OWNER TO "postgres";

-- Signed-in users can read the list; nobody can write it.
GRANT SELECT ON "public"."ingest_servers" TO "authenticated";
