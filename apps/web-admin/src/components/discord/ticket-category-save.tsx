"use client";

import { createContext, useContext, useEffect, useId, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { DiscordActionResult } from "@/lib/discord/action";
import { SaveBar } from "./setting-row";

// The category page edits three things (the form, staff and limits, the
// opening message), each stored by its own server action. They share one save
// bar: it saves the parts that changed and says which one failed, if any.

export interface CategorySavePart {
  /** "Form", "Opening message": names the part when its save fails. */
  label: string;
  dirty: boolean;
  /** Why the part can't be saved as it stands. The part shows this itself too. */
  blocked?: string | null;
  save: () => Promise<DiscordActionResult>;
  reset: () => void;
  /** The toast when the part is saved: "Form saved." */
  saved: string;
}

// Parts register here from an effect; the bar only needs to know whether any
// of them is dirty, so that is the one value the store announces.
function createStore() {
  const parts = new Map<string, CategorySavePart>();
  const listeners = new Set<() => void>();
  let dirty = false;
  const sync = () => {
    const next = [...parts.values()].some((part) => part.dirty);
    if (next === dirty) return;
    dirty = next;
    listeners.forEach((listener) => listener());
  };
  return {
    parts,
    set(id: string, part: CategorySavePart) {
      parts.set(id, part);
      sync();
    },
    remove(id: string) {
      parts.delete(id);
      sync();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    isDirty: () => dirty,
  };
}

const SaveContext = createContext<{ store: ReturnType<typeof createStore>; saving: boolean } | null>(null);

/** Wraps the parts of the category page and draws their one save bar under them. */
export function TicketCategorySave({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [store] = useState(createStore);
  const dirty = useSyncExternalStore(store.subscribe, store.isDirty, () => false);
  const [saving, startSave] = useTransition();
  const context = useMemo(() => ({ store, saving }), [store, saving]);

  const changed = () => [...store.parts.values()].filter((part) => part.dirty);

  const save = () =>
    startSave(async () => {
      const parts = changed();
      const saved: CategorySavePart[] = [];
      let landed = 0;
      // One after the other: each action reports on its own, and a part that
      // fails keeps its edits while the others go through.
      for (const part of parts) {
        if (part.blocked) {
          toast.error(`${part.label} not saved`, { description: part.blocked });
          continue;
        }
        const result = await part.save();
        if (result.error) {
          toast.error(`${part.label} not saved`, { description: result.error });
          continue;
        }
        landed++;
        if (result.warning) toast.warning(result.warning);
        else saved.push(part);
      }
      if (saved.length > 1 && saved.length === parts.length) toast.success("Category saved.");
      else saved.forEach((part) => toast.success(part.saved));
      if (landed > 0) router.refresh();
    });

  return (
    <SaveContext.Provider value={context}>
      {children}
      <SaveBar sticky dirty={dirty} pending={saving} onSave={save} onReset={() => changed().forEach((part) => part.reset())} />
    </SaveContext.Provider>
  );
}

/** Puts one part of the category page behind the shared save bar. Returns true while a save runs. */
export function useCategorySavePart(part: CategorySavePart): boolean {
  const context = useContext(SaveContext);
  if (!context) throw new Error("useCategorySavePart needs a TicketCategorySave above it.");
  const { store, saving } = context;
  const id = useId();

  // Every render, so the bar calls the save that holds the latest values.
  useEffect(() => {
    store.set(id, part);
  });
  useEffect(() => () => store.remove(id), [store, id]);

  return saving;
}
