"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { triggerEvent } from "@/actions/smp/trigger";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TwitchSearchBar from "@/components/search-bars/twitch-channel-search";
import { ChannelSearchResult } from "@/types/twitch";
import { FormProps, DEFAULT_TWITCH_USER } from "./types";

interface ChannelPointsFormValues {
  user_id: string;
  user_login: string;
  user_name: string;
  user_input: string;
  status: string;
  reward_id: string;
  reward_title: string;
  reward_cost: number;
  reward_prompt: string;
}

export function ChannelPointsForm({ selectedStreamer, action, metadata, onClose }: FormProps) {
  const [selectedUser, setSelectedUser] = useState<ChannelSearchResult | null>(DEFAULT_TWITCH_USER);
  const form = useForm<ChannelPointsFormValues>({
    defaultValues: {
      user_id: "12826",
      user_login: "twitch",
      user_name: "Twitch",
      user_input: "",
      status: "unfulfilled",
      reward_id: "",
      reward_title: "",
      reward_cost: 100,
      reward_prompt: "",
    },
  });

  const handleUserSelect = (channel: ChannelSearchResult) => {
    setSelectedUser(channel);
    form.setValue("user_id", channel.id);
    form.setValue("user_login", channel.broadcaster_login);
    form.setValue("user_name", channel.display_name);
  };

  async function onSubmit(values: ChannelPointsFormValues) {
    if (!selectedStreamer) {
      toast.error("Please select a streamer");
      return;
    }

    if (!action) {
      toast.error("Invalid action");
      return;
    }

    const eventData = {
      id: crypto.randomUUID(),
      broadcaster_user_id: selectedStreamer.id,
      broadcaster_user_login: selectedStreamer.broadcaster_login,
      broadcaster_user_name: selectedStreamer.display_name,
      user_id: values.user_id,
      user_login: values.user_login,
      user_name: values.user_name,
      user_input: values.user_input,
      status: values.status,
      reward: {
        id: values.reward_id || crypto.randomUUID(),
        title: values.reward_title,
        cost: Number(values.reward_cost),
        prompt: values.reward_prompt || null,
      },
      redeemed_at: new Date().toISOString(),
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
        <Field>
          <FieldLabel>User Input</FieldLabel>
          <Input {...form.register("user_input")} placeholder="pogchamp" />
        </Field>
        <Field>
          <FieldLabel>Status *</FieldLabel>
          <Select value={form.watch("status")} onValueChange={(v) => form.setValue("status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unfulfilled">Unfulfilled</SelectItem>
              <SelectItem value="fulfilled">Fulfilled</SelectItem>
              <SelectItem value="canceled">Canceled</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="border-t pt-3">
          <p className="text-sm font-medium mb-2">Reward Details</p>
        </div>
        <Field>
          <FieldLabel>Reward ID (auto-generated if empty)</FieldLabel>
          <Input {...form.register("reward_id")} placeholder="92af127c-7326-4483-a52b-b0da0be61c01" />
        </Field>
        <Field>
          <FieldLabel>Reward Title *</FieldLabel>
          <Input {...form.register("reward_title")} placeholder="My Reward" required />
        </Field>
        <Field>
          <FieldLabel>Reward Cost *</FieldLabel>
          <Input type="number" {...form.register("reward_cost", { valueAsNumber: true })} placeholder="100" required min={1} />
        </Field>
        <Field>
          <FieldLabel>Reward Prompt</FieldLabel>
          <Input {...form.register("reward_prompt")} placeholder="Enter your message..." />
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit">Send Test</Button>
      </DialogFooter>
    </form>
  );
}


