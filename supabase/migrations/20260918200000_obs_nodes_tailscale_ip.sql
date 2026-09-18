-- OBS nodes join Tailscale like ingest nodes do, and obs-instance-manager's
-- API port is bound to the node's Tailscale address only. The node reports
-- that address itself via PATCH /api/nodes/me after the deferred join (the
-- auth key it needs to join comes back IN the /claim response, so the IP is
-- unknown at claim time). rest-api also uses it to fill a blank api_url with
-- http://<tailscale_ip>:3000. Same text type as ingest_nodes.tailscale_ip.
ALTER TABLE "public"."obs_nodes" ADD COLUMN "tailscale_ip" text;
