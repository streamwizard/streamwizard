"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@repo/ui";
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
  tag: "Right-click entries and this one already check for ticket staff on their own.",
  "Create ticket from message": "A right-click entry on a message. Anyone can use it; the usual ticket limits apply.",
  "Create ticket for user": "A right-click entry on a member. Checks for ticket staff on its own.",
  "Pin in ticket": "A right-click entry on a message in a ticket. Checks for ticket staff on its own.",
};

// The columns when the list has room (a container of 768px or more, so the
// open sidebar counts). The header row and every command use the same
// template, so they line up like a table.
const COMMAND_GRID = "@3xl:grid @3xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)_8.5rem] @3xl:gap-4";

/** Every command with its allowed roles: a table with room, a card per command on a phone. */
export function CommandPermissionList({ commands, roles }: { commands: CommandView[]; roles: PickerOption[] }) {
  return (
    <div className="@container">
      {/* Column names for the table layout. On a phone each command carries its own labels. */}
      <div className={`hidden border-b px-2 py-2.5 text-sm font-medium ${COMMAND_GRID}`} aria-hidden>
        <span>Command</span>
        <span>Allowed roles</span>
        <span />
      </div>
      <ul className="divide-y">
        {commands.map((command) => (
          // Keyed on the saved roles, so a row resets to the server state after a save.
          <CommandPermissionRow key={`${command.name}:${command.roleIds.join(",")}`} command={command} roles={roles} />
        ))}
      </ul>
    </div>
  );
}

/**
 * One command: a table-like row with room, a card without, with the role
 * picker full width and Save and Undo under it. One element for both layouts,
 * so the unsaved pick isn't held twice.
 */
function CommandPermissionRow({ command, roles }: { command: CommandView; roles: PickerOption[] }) {
  const router = useRouter();
  const [roleIds, setRoleIds] = useState(command.roleIds);
  const [saving, startSave] = useTransition();

  const sorted = (ids: string[]) => JSON.stringify([...ids].sort());
  const dirty = sorted(roleIds) !== sorted(command.roleIds);
  const pickerId = `command-roles-${command.name.replace(/\s+/g, "-")}`;

  const save = () =>
    startSave(async () => {
      const ok = toastResult(await saveCommandRoles({ commandName: command.name, roleIds }), `/${command.name} permissions saved.`);
      if (ok) router.refresh();
    });

  return (
    <li className={`space-y-3 px-4 py-4 sm:px-2 @3xl:space-y-0 @3xl:py-3 ${COMMAND_GRID}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 font-mono text-sm break-all">
          /{command.name}
          {!command.deployed && (
            <Badge variant="outline" className="font-sans text-[10px]">
              not deployed
            </Badge>
          )}
        </div>
        {command.description && <p className="mt-0.5 text-xs text-muted-foreground">{command.description}</p>}
        {COMMAND_NOTES[command.name] && <p className="mt-1 text-xs text-muted-foreground">{COMMAND_NOTES[command.name]}</p>}
      </div>
      <div className="min-w-0 space-y-1.5">
        {/* The header row names this column in the table layout. */}
        <label htmlFor={pickerId} className="text-xs text-muted-foreground @3xl:sr-only">
          Allowed roles
        </label>
        <MultiPicker
          id={pickerId}
          options={roles}
          value={roleIds}
          onChange={setRoleIds}
          placeholder="Everyone"
          emptyText="No roles match"
          disabled={saving}
        />
      </div>
      {dirty ? (
        <div className="flex gap-2 @3xl:justify-end @3xl:gap-1">
          <Button size="sm" variant="ghost" className="h-11 flex-1 md:h-8 @3xl:flex-none" onClick={() => setRoleIds(command.roleIds)} disabled={saving}>
            Undo
          </Button>
          <Button size="sm" className="h-11 flex-1 md:h-8 @3xl:flex-none" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      ) : (
        // Keeps the third column in place in the table layout; takes no room in a card.
        <div className="hidden @3xl:block" />
      )}
    </li>
  );
}
