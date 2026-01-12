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

interface GiftSubFormValues {
  user_id: string;
  user_login: string;
  user_name: string;
  total: number;
  tier: string;
  cumulative_total: string;
  is_anonymous: boolean;
}

export function GiftSubForm({ selectedStreamer, action, metadata, onClose }: FormProps) {
  const [selectedUser, setSelectedUser] = useState<ChannelSearchResult | null>(DEFAULT_TWITCH_USER);
  const form = useForm<GiftSubFormValues>({
    defaultValues: {
      user_id: "12826",
      user_login: "twitch",
      user_name: "Twitch",
      total: 1,
      tier: "1000",
      cumulative_total: "",
      is_anonymous: false,
    },
  });

  const handleUserSelect = (channel: ChannelSearchResult) => {
    setSelectedUser(channel);
    form.setValue("user_id", channel.id);
    form.setValue("user_login", channel.broadcaster_login);
    form.setValue("user_name", channel.display_name);
  };

  async function onSubmit(values: GiftSubFormValues) {
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
      total: Number(values.total),
      tier: values.tier,
      cumulative_total: values.cumulative_total ? Number(values.cumulative_total) : null,
      is_anonymous: values.is_anonymous,
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
          <FieldLabel>Gifter *</FieldLabel>
          <TwitchSearchBar
            placeholder="Search for a gifter"
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
          <FieldLabel>Total Gifts *</FieldLabel>
          <Input type="number" {...form.register("total", { valueAsNumber: true })} placeholder="2" required min={1} />
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
          <FieldLabel>Cumulative Total (optional)</FieldLabel>
          <Input type="number" {...form.register("cumulative_total")} placeholder="284" />
        </Field>
        <Field>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_anonymous"
              {...form.register("is_anonymous")}
              className="h-4 w-4 rounded"
            />
            <FieldLabel htmlFor="is_anonymous" className="cursor-pointer">Is Anonymous</FieldLabel>
          </div>
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit">Send Test</Button>
      </DialogFooter>
    </form>
  );
}


