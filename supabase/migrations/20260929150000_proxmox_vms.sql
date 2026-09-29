-- Proxmox VM monitoring (docs/proxmox-monitoring-plan.md).
--
-- VM state and metrics come from Proxmox's own External Metric Server in the
-- InfluxDB `proxmox` bucket; guest IPs are read from the PVE API on demand.
-- The only thing stored here is which alerts the admin switched on per VM.

-- Per-VM alert opt-in: rule ids from packages/alerting (vm.down, …). Keyed
-- on the PVE node name and vmid (standalone hosts reuse vmids). No row, or
-- an empty array, means the VM sends no alerts.
CREATE TABLE IF NOT EXISTS "public"."proxmox_vm_alert_settings" (
    "host" text NOT NULL,
    "vmid" integer NOT NULL,
    "rules" text[] NOT NULL DEFAULT '{}',
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    "updated_by" uuid,
    PRIMARY KEY ("host", "vmid")
);

ALTER TABLE "public"."proxmox_vm_alert_settings" OWNER TO "postgres";

-- RLS: web-admin server actions write as service_role; admins may read.
ALTER TABLE "public"."proxmox_vm_alert_settings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read proxmox vm alert settings" ON "public"."proxmox_vm_alert_settings"
    AS PERMISSIVE FOR SELECT TO authenticated
    USING ( ( SELECT public.check_user_role('admin') ) );

GRANT ALL ON TABLE "public"."proxmox_vm_alert_settings" TO "service_role";
GRANT SELECT ON TABLE "public"."proxmox_vm_alert_settings" TO "authenticated";
