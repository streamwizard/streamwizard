"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DeckTab } from "@/components/deck/deck-tab-bar";
import type { SaveBarActions, SaveBarState } from "@/components/deck/switcher-settings-panel";

/**
 * Deck tab navigation, including the switcher tab's unsaved-changes contract.
 *
 * Opening the switcher pushes a history entry so the system back gesture
 * (Android predictive back, iOS swipe) closes the tab instead of leaving the
 * deck. Leaving it mid-edit — by tab or by gesture — has to ask first, and
 * popstate can't be cancelled, so the consumed entry is re-armed before the
 * prompt goes up.
 */
export function useDeckTabs() {
  const [tab, setTab] = useState<DeckTab>("deck");
  const [saveBar, setSaveBar] = useState<SaveBarState | null>(null);
  const saveBarActionsRef = useRef<SaveBarActions | null>(null);
  const [discardPrompt, setDiscardPrompt] = useState<DeckTab | null>(null);

  // The panel unmounts with the tab, so its save-bar state leaves with it.
  const leaveSwitcher = useCallback(() => {
    setSaveBar(null);
    saveBarActionsRef.current = null;
  }, []);

  const goToTab = useCallback(
    (next: DeckTab) => {
      if (tab === next) return;
      if (next === "switcher") {
        window.history.pushState({ deckTab: "switcher" }, "");
      } else {
        leaveSwitcher();
        if (window.history.state?.deckTab === "switcher") window.history.back();
      }
      setTab(next);
    },
    [tab, leaveSwitcher],
  );

  const handleTabChange = (next: DeckTab) => {
    // Leaving the switcher tab mid-edit would silently drop the changes.
    if (tab === "switcher" && next !== "switcher" && saveBar?.dirty) {
      setDiscardPrompt(next);
      return;
    }
    goToTab(next);
  };

  const switcherDirty = saveBar?.dirty ?? false;
  useEffect(() => {
    const onPopState = () => {
      if (switcherDirty) {
        // popstate can't be cancelled, so re-arm the entry we just consumed and
        // ask before throwing the edits away.
        window.history.pushState({ deckTab: "switcher" }, "");
        setDiscardPrompt("deck");
        return;
      }
      leaveSwitcher();
      setTab("deck");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [switcherDirty, leaveSwitcher]);

  return {
    tab,
    handleTabChange,
    goToTab,
    saveBar,
    setSaveBar,
    saveBarActionsRef,
    discardPrompt,
    setDiscardPrompt,
    switcherDirty,
  };
}
