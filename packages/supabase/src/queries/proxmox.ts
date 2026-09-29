import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

// VM state itself lives in Influx (PVE pushes it); only the admin's per-VM
// alert opt-in is stored here.
export type ProxmoxVmAlertSettingsRow = Database["public"]["Tables"]["proxmox_vm_alert_settings"]["Row"];

export async function getVmAlertSettings(client: DBClient): Promise<ProxmoxVmAlertSettingsRow[]> {
  const { data, error } = await client.from("proxmox_vm_alert_settings").select("*");
  if (error) throw new Error(`Couldn't load VM alert settings: ${error.message}`);
  return data;
}

/** Replaces the VM's rule list. An empty list switches all its alerts off. */
export async function setVmAlertRules(client: DBClient, host: string, vmid: number, rules: string[], userId: string | null): Promise<void> {
  const { error } = await client
    .from("proxmox_vm_alert_settings")
    .upsert(
      { host, vmid, rules: [...new Set(rules)].sort(), updated_at: new Date().toISOString(), updated_by: userId },
      { onConflict: "host,vmid" },
    );
  if (error) throw new Error(`Couldn't save VM alert settings: ${error.message}`);
}
