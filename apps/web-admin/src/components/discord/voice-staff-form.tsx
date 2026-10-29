"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui";
import { saveVoiceSettingsAction } from "@/actions/discord-voice";
import type { PickerOption } from "@/lib/discord/options";
import { MultiPicker } from "./pickers";
import { SaveBar } from "./setting-row";
import { toastResult } from "./toast-result";

/** The server's voice staff roles. A lobby can swap in its own list. */
export function VoiceStaffForm({ initial, roles, limit }: { initial: string[]; roles: PickerOption[]; limit: number }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [saving, startSave] = useTransition();
  const dirty = [...value].sort().join() !== [...initial].sort().join();

  const save = () =>
    startSave(async () => {
      if (toastResult(await saveVoiceSettingsAction({ staffRoleIds: value }), "Voice staff roles saved.")) router.refresh();
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Voice staff</CardTitle>
        <CardDescription>
          People with these roles can&apos;t be kicked or banned from a voice channel, always get in (locked, hidden or
          full), and /voice-claim takes a channel over even while its owner is there. A lobby can use its own roles
          instead.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <MultiPicker
          id="voice-staff-roles"
          options={roles}
          value={value}
          onChange={setValue}
          placeholder="Pick roles"
          emptyText="No roles match"
          disabled={saving}
        />
        {value.length > limit && <p className="text-xs text-destructive">Up to {limit} roles.</p>}
        <SaveBar dirty={dirty} pending={saving} onSave={save} onReset={() => setValue(initial)} />
      </CardContent>
    </Card>
  );
}
