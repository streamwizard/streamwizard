"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Label, Switch } from "@repo/ui";
import { setVmAlerts } from "@/actions/vm-alerts";

interface VmAlertRuleOption {
  id: string;
  title: string;
  description: string;
}

/** One switch per vm.* rule; each flip saves the whole list right away. */
export function VmAlertsCard({
  host,
  vmid,
  rules,
  initialEnabled,
}: {
  host: string;
  vmid: number;
  rules: readonly VmAlertRuleOption[];
  initialEnabled: string[];
}) {
  const [enabled, setEnabled] = useState(() => new Set(initialEnabled));
  const [pending, startSave] = useTransition();

  const toggle = (id: string, on: boolean) => {
    const previous = enabled;
    const next = new Set(previous);
    if (on) next.add(id);
    else next.delete(id);
    setEnabled(next);
    startSave(async () => {
      const result = await setVmAlerts(host, vmid, [...next]);
      if (result.error) {
        setEnabled(previous);
        toast.error(result.error);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Alerts</CardTitle>
        <CardDescription>
          Off by default. Thresholds are on the{" "}
          <Link href="/alerts/rules" className="underline underline-offset-4">
            Rules
          </Link>{" "}
          page. Host alerts (unreachable, public IP changed) are always on.
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        {rules.map((rule) => {
          const id = `vm-alert-${rule.id}`;
          return (
            <div key={rule.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div>
                <Label htmlFor={id} className="font-medium">
                  {rule.title}
                </Label>
                <p className="text-xs text-muted-foreground">{rule.description}</p>
              </div>
              <Switch id={id} checked={enabled.has(rule.id)} onCheckedChange={(on) => toggle(rule.id, on)} disabled={pending} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
