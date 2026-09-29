"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { setVmAlertRules } from "@repo/supabase/queries/proxmox";
import { queryLatestProxmoxGuests } from "@repo/metrics";
import { STREAMWIZARD_VM_TAG, isStreamwizardVm, isVmAlertRuleId } from "@repo/alerting/rules";
import { assertAdmin } from "@/lib/assert-admin";

/**
 * Replace which vm.* alerts a VM sends. The alert worker reads the list on
 * its next tick. Returns an error message instead of throwing, because Next
 * hides thrown messages from the client in production.
 */
export async function setVmAlerts(host: string, vmid: number, rules: string[]): Promise<{ error?: string }> {
  const userId = await assertAdmin();

  if (typeof host !== "string" || host.length === 0 || host.length > 100) return { error: "Unknown host" };
  if (!Number.isInteger(vmid) || vmid <= 0) return { error: "Unknown VM" };
  if (!Array.isArray(rules)) return { error: "Rules must be a list" };
  const unknown = rules.filter((r) => typeof r !== "string" || !isVmAlertRuleId(r));
  if (unknown.length > 0) return { error: `Unknown alert: ${unknown.join(", ")}` };

  try {
    // Proxmox pushes every guest (stopped ones too) to Influx; one it hasn't
    // reported for a day is gone.
    const vm = (await queryLatestProxmoxGuests("24h")).find((g) => g.nodename === host && g.vmid === vmid);
    if (!vm) return { error: "Proxmox hasn't reported this VM in the last day" };
    // The alert worker skips untagged VMs, so a setting here would do nothing.
    if (!isStreamwizardVm(vm.tags)) return { error: `Add the tag ${STREAMWIZARD_VM_TAG} in Proxmox to enable alerts.` };
    await setVmAlertRules(supabaseAdmin, host, vmid, rules, userId);
  } catch (error) {
    console.error("[setVmAlerts]", error);
    return { error: (error as Error).message };
  }

  revalidatePath("/vms");
  revalidatePath(`/vms/${encodeURIComponent(host)}/${vmid}`);
  return {};
}
