"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { triggerEvent } from "@/actions/smp/trigger";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import TwitchSearchBar from "@/components/search-bars/twitch-channel-search";
import { ChannelSearchResult } from "@/types/twitch";
import { FormProps, DEFAULT_TWITCH_USER } from "./types";

interface FollowFormValues {
  user_id: string;
  user_login: string;
  user_name: string;
}

export function FollowForm({ selectedStreamer, action, metadata, onClose }: FormProps) {
  const [selectedUser, setSelectedUser] = useState<ChannelSearchResult | null>(DEFAULT_TWITCH_USER);
  const form = useForm<FollowFormValues>({
    defaultValues: {
      user_id: "12826",
      user_login: "twitch",
      user_name: "Twitch",
    },
  });

  const handleUserSelect = (channel: ChannelSearchResult) => {
    setSelectedUser(channel);
    form.setValue("user_id", channel.id);
    form.setValue("user_login", channel.broadcaster_login);
    form.setValue("user_name", channel.display_name);
  };

  async function onSubmit(values: FollowFormValues) {
    if (!selectedStreamer) {
      toast.error("Please select a streamer");
      return;
    }

    if (!action) {
      toast.error("Invalid action");
      return;
    }

    const eventData = {
      user_id: values.user_id,
      user_login: values.user_login,
      user_name: values.user_name,
      broadcaster_user_id: selectedStreamer.id,
      broadcaster_user_login: selectedStreamer.broadcaster_login,
      broadcaster_user_name: selectedStreamer.display_name,
      followed_at: new Date().toISOString(),
    };

    try {
      await triggerEvent(action, selectedStreamer.id, metadata || {}, eventData);
      toast.success("Test trigger sent!");
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("Failed to send test trigger");
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <FieldGroup className="space-y-3">
        <Field>
          <FieldLabel>User *</FieldLabel>
          <TwitchSearchBar
            placeholder="Search for a viewer"
            onSelect={handleUserSelect}
            value={selectedUser?.id}
            initalValue={"12826"}
          />
          {selectedUser && (
            <p className="text-xs text-green-600 mt-1">
              ✓ {selectedUser.display_name} ({selectedUser.broadcaster_login})
            </p>
          )}
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit">Send Test</Button>
      </DialogFooter>
    </form>
  );
}

