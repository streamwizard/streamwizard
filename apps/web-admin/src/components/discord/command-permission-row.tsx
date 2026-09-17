"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, TableCell, TableRow } from "@repo/ui";
import { saveCommandRoles } from "@/actions/discord-permissions";
import type { PickerOption } from "@/lib/discord/options";
import { MultiPicker } from "./pickers";
import { toastResult } from "./toast-result";

export interface CommandView {
  name: string;
  description: string | null;
  /** False for commands that only exist in stored permissions. */
  deployed: boolean;
  roleIds: string[];
}

// A rule here covers the whole command. Where that would bite, the row says so.
const COMMAND_NOTES: Record<string, string> = {
  ticket:
    "Leave this one open to everyone. Members use it to open and list tickets, and its staff subcommands already check for ticket staff on their own.",
};

export function CommandPermissionRow({ command, roles }: { command: CommandView; roles: PickerOption[] }) {
  const router = useRouter();
  const [roleIds, setRoleIds] = useState(command.roleIds);
  const [saving, startSave] = useTransition();

  const sorted = (ids: string[]) => JSON.stringify([...ids].sort());
  const dirty = sorted(roleIds) !== sorted(command.roleIds);

  const save = () =>
    startSave(async () => {
      const ok = toastResult(await saveCommandRoles({ commandName: command.name, roleIds }), `/${command.name} permissions saved.`);
      if (ok) router.refresh();
    });

  return (
    <TableRow>
      <TableCell className="align-top">
        <div className="flex items-center gap-2 font-mono text-sm">
          /{command.name}
          {!command.deployed && (
            <Badge variant="outline" className="font-sans text-[10px]">
              not deployed
            </Badge>
          )}
        </div>
        {command.description && <p className="mt-0.5 text-xs text-muted-foreground">{command.description}</p>}
        {COMMAND_NOTES[command.name] && <p className="mt-1 text-xs text-muted-foreground">{COMMAND_NOTES[command.name]}</p>}
      </TableCell>
      <TableCell className="w-[min(28rem,50%)] align-top">
        <MultiPicker
          options={roles}
          value={roleIds}
          onChange={setRoleIds}
          placeholder="Everyone"
          emptyText="No roles match"
          disabled={saving}
        />
      </TableCell>
      <TableCell className="w-32 text-right align-top">
        {dirty && (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => setRoleIds(command.roleIds)} disabled={saving}>
              Undo
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
