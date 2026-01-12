"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Field, FieldDescription, FieldLabel } from "../ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import TwitchSearchBar from "../search-bars/twitch-channel-search";
import { TRIGGER_EVENT_TYPES, TriggerEventType, Trigger } from "./trigger-config";
import { ChannelSearchResult } from "@/types/twitch";
import { useSession } from "@/providers/session-provider";
import {
  FollowForm,
  SubscribeForm,
  GiftSubForm,
  SubMessageForm,
  RaidForm,
  CheerForm,
  ChannelPointsForm,
  DEFAULT_TWITCH_USER,
} from "./test-trigger-forms";

// Helper function to create ChannelSearchResult from session data
function createChannelSearchResultFromSession(session: any): ChannelSearchResult | null {
  // Check for provider_id (used in TwitchSearchBar) or sub (Twitch OAuth standard)
  const providerId = session?.user_metadata?.provider_id || session?.user_metadata?.sub;
  if (!providerId) {
    return null;
  }

  const displayName = session.user_metadata.preferred_username || session.user_metadata.name || session.user_metadata.login || "";
  const login = session.user_metadata.preferred_username || session.user_metadata.login || displayName.toLowerCase() || "";

  return {
    id: providerId,
    broadcaster_login: login || providerId, // Fallback to providerId if no login found
    display_name: displayName || login || providerId, // Fallback to providerId if no display name found
    broadcaster_language: "en",
    game_id: "",
    game_name: "",
    is_live: false,
    tags: [],
    thumbnail_url: session.user_metadata.picture || session.user_metadata.avatar_url || "",
    title: "",
  };
}

interface TestTriggerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: string;
  metadata: Record<string, any>;
  triggers: Trigger[];
  selectedEvent?: { label: string; description: string } | null;
}

export function TestTriggerModal({
  open,
  onOpenChange,
  action,
  metadata,
  triggers,
  selectedEvent,
}: TestTriggerModalProps) {
  const session = useSession();
  const loggedInUser = useMemo(() => createChannelSearchResultFromSession(session) || DEFAULT_TWITCH_USER, [session]);
  const [selectedStreamer, setSelectedStreamer] = useState<ChannelSearchResult | null>(loggedInUser);
  const [selectedTriggerIndex, setSelectedTriggerIndex] = useState<number>(0);
  const activeTrigger = triggers.length > 0 ? triggers[selectedTriggerIndex] : null;
  const triggerEventType = activeTrigger?.event_type || TRIGGER_EVENT_TYPES.CHANNEL_FOLLOW;

  // Update selectedStreamer when session changes or modal opens
  useEffect(() => {
    if (loggedInUser && open) {
      setSelectedStreamer(loggedInUser);
    }
  }, [loggedInUser, open]);

  const handleTriggerChange = (index: number) => {
    setSelectedTriggerIndex(index);
  };

  const handleStreamerSelect = (channel: ChannelSearchResult) => {
    setSelectedStreamer(channel);
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedStreamer(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Test Trigger</DialogTitle>
          <DialogDescription>
            Test this action without saving. Broadcaster info is auto-filled from the selected streamer.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Trigger Selection */}
          {triggers.length > 0 && (
            <Field>
              <FieldLabel>Select Trigger</FieldLabel>
              <Select
                value={selectedTriggerIndex.toString()}
                onValueChange={(value) => handleTriggerChange(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {triggers.map((trigger, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {trigger.event_type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>Choose which trigger to test</FieldDescription>
            </Field>
          )}

          {/* Streamer Selection */}
          <Field>
            <FieldLabel>Streamer *</FieldLabel>
            <TwitchSearchBar
              placeholder="Search for a streamer"
              onSelect={handleStreamerSelect}
              value={selectedStreamer?.id}
              initalValue={session?.user_metadata.provider_id}
            />
            <FieldDescription>
              Broadcaster info will be auto-filled from selected streamer
            </FieldDescription>
            {selectedStreamer && (
              <p className="text-xs text-green-600 mt-1">
                ✓ {selectedStreamer.display_name} ({selectedStreamer.broadcaster_login})
              </p>
            )}
          </Field>

          {/* Action Info */}
          {selectedEvent && (
            <div className="rounded-lg border p-4 bg-muted/50">
              <p className="text-sm font-medium mb-1">Action: {selectedEvent.label}</p>
              <p className="text-xs text-muted-foreground">{selectedEvent.description}</p>
            </div>
          )}
        </div>

        {/* Render the appropriate form based on trigger type */}
        {triggerEventType === TRIGGER_EVENT_TYPES.CHANNEL_FOLLOW && (
          <FollowForm
            selectedStreamer={selectedStreamer}
            action={action}
            metadata={metadata}
            onClose={handleClose}
          />
        )}
        {triggerEventType === TRIGGER_EVENT_TYPES.CHANNEL_SUBSCRIBE && (
          <SubscribeForm
            selectedStreamer={selectedStreamer}
            action={action}
            metadata={metadata}
            onClose={handleClose}
          />
        )}
        {triggerEventType === TRIGGER_EVENT_TYPES.CHANNEL_SUBSCRIPTION_GIFT && (
          <GiftSubForm
            selectedStreamer={selectedStreamer}
            action={action}
            metadata={metadata}
            onClose={handleClose}
          />
        )}
        {triggerEventType === TRIGGER_EVENT_TYPES.CHANNEL_SUBSCRIPTION_MESSAGE && (
          <SubMessageForm
            selectedStreamer={selectedStreamer}
            action={action}
            metadata={metadata}
            onClose={handleClose}
          />
        )}
        {triggerEventType === TRIGGER_EVENT_TYPES.CHANNEL_RAID && (
          <RaidForm
            selectedStreamer={selectedStreamer}
            action={action}
            metadata={metadata}
            onClose={handleClose}
          />
        )}
        {triggerEventType === TRIGGER_EVENT_TYPES.CHANNEL_CHEER && (
          <CheerForm
            selectedStreamer={selectedStreamer}
            action={action}
            metadata={metadata}
            onClose={handleClose}
          />
        )}
        {triggerEventType === TRIGGER_EVENT_TYPES.CHANNEL_POINTS_REDEMPTION && (
          <ChannelPointsForm
            selectedStreamer={selectedStreamer}
            action={action}
            metadata={metadata}
            onClose={handleClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
