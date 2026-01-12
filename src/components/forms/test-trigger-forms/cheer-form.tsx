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

interface CheerFormValues {
  is_anonymous: boolean;
  user_id: string;
  user_login: string;
  user_name: string;
  message: string;
  bits: number;
}

export function CheerForm({ selectedStreamer, action, metadata, onClose }: FormProps) {
  const [selectedUser, setSelectedUser] = useState<ChannelSearchResult | null>(DEFAULT_TWITCH_USER);
  const form = useForm<CheerFormValues>({
    defaultValues: {
      is_anonymous: false,
      user_id: "12826",
      user_login: "twitch",
      user_name: "Twitch",
      message: "",
      bits: 100,
    },
  });

  const isAnonymous = form.watch("is_anonymous");

  const handleUserSelect = (channel: ChannelSearchResult) => {
    setSelectedUser(channel);
    form.setValue("user_id", channel.id);
    form.setValue("user_login", channel.broadcaster_login);
    form.setValue("user_name", channel.display_name);
  };

  async function onSubmit(values: CheerFormValues) {
    if (!selectedStreamer) {
      toast.error("Please select a streamer");
      return;
    }

    if (!action) {
      toast.error("Invalid action");
      return;
    }

    const eventData = {
      is_anonymous: values.is_anonymous,
      user_id: values.is_anonymous ? null : values.user_id,
      user_login: values.is_anonymous ? null : values.user_login,
      user_name: values.is_anonymous ? null : values.user_name,
      broadcaster_user_id: selectedStreamer.id,
      broadcaster_user_login: selectedStreamer.broadcaster_login,
      broadcaster_user_name: selectedStreamer.display_name,
      message: values.message,
      bits: Number(values.bits),
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
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_anonymous_cheer"
              {...form.register("is_anonymous")}
              className="h-4 w-4 rounded"
            />
            <FieldLabel htmlFor="is_anonymous_cheer" className="cursor-pointer">Is Anonymous</FieldLabel>
          </div>
        </Field>
        {!isAnonymous && (
          <Field>
            <FieldLabel>User *</FieldLabel>
            <TwitchSearchBar
              placeholder="Search for a user"
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
        )}
        <Field>
          <FieldLabel>Message *</FieldLabel>
          <Input {...form.register("message")} placeholder="pogchamp" required />
        </Field>
        <Field>
          <FieldLabel>Bits *</FieldLabel>
          <Input type="number" {...form.register("bits", { valueAsNumber: true })} placeholder="1000" required min={1} />
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit">Send Test</Button>
      </DialogFooter>
    </form>
  );
}


