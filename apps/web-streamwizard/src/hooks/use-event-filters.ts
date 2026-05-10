"use client";

import { useState, useEffect, useCallback } from "react";
import { StreamEventType } from "@/types/stream-events";

const STORAGE_KEY = "vods-event-filters";

/**
 * Custom hook to manage event type filters with localStorage persistence
 */
export function useEventFilters() {
  const [selectedTypes, setSelectedTypes] = useState<Set<StreamEventType>>(() => {
    // Initialize from localStorage or default to all types selected
    if (typeof window === "undefined") return new Set();

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as StreamEventType[];
        return new Set(parsed);
      }
    } catch (error) {
      console.error("Failed to load event filters from localStorage:", error);
    }

    // Default: all types selected
    return new Set<StreamEventType>([
      "channel.follow",
      "channel.subscribe",
      "channel.subscription.message",
      "channel.subscription.gift",
      "channel.raid",
      "channel.cheer",
      "channel.ban",
      "channel.unban",
      "channel.shoutout.create",
      "channel.shoutout.receive",
      "channel.channel_points_custom_reward_redemption.add",
      "channel.moderator.add",
      "channel.moderator.remove",
    ]);
  });

  // Save to localStorage whenever selection changes
  useEffect(() => {
    try {
      const array = Array.from(selectedTypes);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(array));
    } catch (error) {
      console.error("Failed to save event filters to localStorage:", error);
    }
  }, [selectedTypes]);

  const toggleType = useCallback((type: StreamEventType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedTypes(
      new Set<StreamEventType>([
        "channel.follow",
        "channel.subscribe",
        "channel.subscription.message",
        "channel.subscription.gift",
        "channel.raid",
        "channel.cheer",
        "channel.ban",
        "channel.unban",
        "channel.shoutout.create",
        "channel.shoutout.receive",
        "channel.channel_points_custom_reward_redemption.add",
        "channel.moderator.add",
        "channel.moderator.remove",
      ]),
    );
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedTypes(new Set());
  }, []);

  const isSelected = useCallback((type: StreamEventType) => selectedTypes.has(type), [selectedTypes]);

  return {
    selectedTypes,
    toggleType,
    selectAll,
    deselectAll,
    isSelected,
  };
}
