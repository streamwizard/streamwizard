"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { triggerEvent } from "@/actions/smp/trigger";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import TwitchSearchBar from "@/components/search-bars/twitch-channel-search";
import { ChannelSearchResult } from "@/types/twitch";
import { FormProps, DEFAULT_TWITCH_USER } from "./types";

interface RaidFormValues {
  from_broadcaster_user_id: string;
  from_broadcaster_user_login: string;
  from_broadcaster_user_name: string;
  viewers: number;
}

export function RaidForm({ selectedStreamer, action, metadata, onClose }: FormProps) {
  const [selectedRaider, setSelectedRaider] = useState<ChannelSearchResult | null>(DEFAULT_TWITCH_USER);
  const form = useForm<RaidFormValues>({
    defaultValues: {
      from_broadcaster_user_id: "12826",
      from_broadcaster_user_login: "twitch",
      from_broadcaster_user_name: "Twitch",
      viewers: 100,
    },
  });

  const handleRaiderSelect = (channel: ChannelSearchResult) => {
    setSelectedRaider(channel);
    form.setValue("from_broadcaster_user_id", channel.id);
    form.setValue("from_broadcaster_user_login", channel.broadcaster_login);
    form.setValue("from_broadcaster_user_name", channel.display_name);
  };

  async function onSubmit(values: RaidFormValues) {
    if (!selectedStreamer) {
      toast.error("Please select a streamer");
      return;
    }

    if (!action) {
      toast.error("Invalid action");
      return;
    }

    const eventData = {
      from_broadcaster_user_id: values.from_broadcaster_user_id,
      from_broadcaster_user_login: values.from_broadcaster_user_login,
      from_broadcaster_user_name: values.from_broadcaster_user_name,
      to_broadcaster_user_id: selectedStreamer.id,
      to_broadcaster_user_login: selectedStreamer.broadcaster_login,
      to_broadcaster_user_name: selectedStreamer.display_name,
      viewers: Number(values.viewers),
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
          <FieldLabel>Raider *</FieldLabel>
          <TwitchSearchBar
            placeholder="Search for a raider"
            onSelect={handleRaiderSelect}
            value={selectedRaider?.id}
            initalValue={"12826"}
          />
          {selectedRaider && (
            <p className="text-xs text-green-600 mt-1">
              ✓ {selectedRaider.display_name} ({selectedRaider.broadcaster_login})
            </p>
          )}
        </Field>
        <Field>
          <FieldLabel>Viewers *</FieldLabel>
          <Input type="number" {...form.register("viewers", { valueAsNumber: true })} placeholder="9001" required min={0} />
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit">Send Test</Button>
      </DialogFooter>
    </form>
  );
}


