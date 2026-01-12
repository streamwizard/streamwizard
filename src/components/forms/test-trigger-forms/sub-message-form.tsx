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

interface SubMessageFormValues {
  user_id: string;
  user_login: string;
  user_name: string;
  tier: string;
  message_text: string;
  cumulative_months: number;
  streak_months: string;
  duration_months: number;
}

export function SubMessageForm({ selectedStreamer, action, metadata, onClose }: FormProps) {
  const [selectedUser, setSelectedUser] = useState<ChannelSearchResult | null>(DEFAULT_TWITCH_USER);
  const form = useForm<SubMessageFormValues>({
    defaultValues: {
      user_id: "12826",
      user_login: "twitch",
      user_name: "Twitch",
      tier: "1000",
      message_text: "",
      cumulative_months: 1,
      streak_months: "",
      duration_months: 1,
    },
  });

  const handleUserSelect = (channel: ChannelSearchResult) => {
    setSelectedUser(channel);
    form.setValue("user_id", channel.id);
    form.setValue("user_login", channel.broadcaster_login);
    form.setValue("user_name", channel.display_name);
  };

  async function onSubmit(values: SubMessageFormValues) {
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
      tier: values.tier,
      message: {
        text: values.message_text,
        emotes: [],
      },
      cumulative_months: Number(values.cumulative_months),
      streak_months: values.streak_months ? Number(values.streak_months) : null,
      duration_months: Number(values.duration_months),
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
          <FieldLabel>Tier *</FieldLabel>
          <Select value={form.watch("tier")} onValueChange={(v) => form.setValue("tier", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1000">Tier 1 (1000)</SelectItem>
              <SelectItem value="2000">Tier 2 (2000)</SelectItem>
              <SelectItem value="3000">Tier 3 (3000)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Message *</FieldLabel>
          <Input {...form.register("message_text")} placeholder="Love the stream!" required />
        </Field>
        <Field>
          <FieldLabel>Cumulative Months *</FieldLabel>
          <Input type="number" {...form.register("cumulative_months", { valueAsNumber: true })} placeholder="15" required min={1} />
        </Field>
        <Field>
          <FieldLabel>Streak Months (optional)</FieldLabel>
          <Input type="number" {...form.register("streak_months")} placeholder="1" />
        </Field>
        <Field>
          <FieldLabel>Duration Months *</FieldLabel>
          <Input type="number" {...form.register("duration_months", { valueAsNumber: true })} placeholder="6" required min={1} />
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit">Send Test</Button>
      </DialogFooter>
    </form>
  );
}


