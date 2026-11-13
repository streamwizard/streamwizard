"use client";

import { useState } from "react";
import { SmpNameEditForm } from "@/components/public/smp/smp-name-edit-form";

/*
 * What someone on the waitlist sees on every later visit. The Minecraft name
 * can still be changed while the application is pending; after that the edit
 * is gone, because the stored UUID is what the server lets in.
 */
export function SmpDonePanel({ minecraftUsername, editable }: { minecraftUsername: string; editable: boolean }) {
  const [editing, setEditing] = useState(false);

  return (
    <div className="pixel-panel p-6 sm:p-8">
      <h3 className="pixel-shadow font-pixel text-2xl font-semibold text-(--smp-gold)">You&apos;re on the waitlist.</h3>
      <p className="mt-2 text-sm text-foreground/90">
        Applications are open and the launch date will be announced. Nothing else to do for now.
      </p>

      {editing ? (
        <div className="mt-6">
          <SmpNameEditForm currentName={minecraftUsername} onDone={() => setEditing(false)} />
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          <p className="text-sm text-foreground/90">
            Minecraft name: <span className="font-mono font-medium text-white">{minecraftUsername}</span>
          </p>
          {editable && (
            <button type="button" onClick={() => setEditing(true)} className="pixel-btn">
              Change Minecraft name
            </button>
          )}
        </div>
      )}
    </div>
  );
}
