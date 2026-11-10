"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { reportError } from "@repo/sentry";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { setVmAlertRules } from "@repo/supabase/queries/platform/proxmox";
import { queryLatestProxmoxGuests } from "@repo/metrics";
import { STREAMWIZARD_VM_TAG, VM_ALERT_RULE_IDS, isStreamwizardVm } from "@repo/alerting/rules";
import { requireAdmin } from "@/lib/auth/admin-context";

const vmAlertsSchema = z.object({
  host: z.string().min(1).max(100),
  vmid: z.number().int().positive().max(999_999_999),
  rules: z.array(z.string().max(100)).max(VM_ALERT_RULE_IDS.length),
});

/**
 * Replace which vm.* alerts a VM sends. The alert worker reads the list on
 * its next tick. Returns an error message instead of throwing, because Next
 * hides thrown messages from the client in production.
 */
export async function setVmAlerts(host: string, vmid: number, rules: string[]): Promise<{ error?: string }> {
  let userId: string;
  try {
    userId = await requireAdmin();
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Not authorized" };
  }

  const parsed = vmAlertsSchema.safeParse({ host, vmid, rules });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return { error: field === "host" ? "Unknown host" : field === "vmid" ? "Unknown VM" : "Rules must be a list of alerts" };
  }
  const known: readonly string[] = VM_ALERT_RULE_IDS;
  const unknown = parsed.data.rules.filter((r) => !known.includes(r));
  if (unknown.length > 0) return { error: `Unknown alert: ${unknown.join(", ")}` };
  const target = parsed.data;

  try {
    // Proxmox pushes every guest (stopped ones too) to Influx; one it hasn't
    // reported for a day is gone.
    const vm = (await queryLatestProxmoxGuests("24h")).find((g) => g.nodename === target.host && g.vmid === target.vmid);
    if (!vm) return { error: "Proxmox hasn't reported this VM in the last day" };
    // The alert worker skips untagged VMs, so a setting here would do nothing.
    if (!isStreamwizardVm(vm.tags)) return { error: `Add the tag ${STREAMWIZARD_VM_TAG} in Proxmox to enable alerts.` };
    await setVmAlertRules(supabaseAdmin, target.host, target.vmid, target.rules, userId);
  } catch (error) {
    reportError(error, "vm-alerts.save", { host: target.host, vmid: target.vmid });
    return { error: "Couldn't save the VM alerts. Try again?" };
  }

  revalidatePath("/vms");
  revalidatePath(`/vms/${encodeURIComponent(target.host)}/${target.vmid}`);
  return {};
}
