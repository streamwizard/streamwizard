"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../ui/button";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "../ui/field";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Switch } from "../ui/switch";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { createChannelPointsTemplate, updateChannelPointsTemplate, getAllActions } from "@/actions/smp";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Database } from "@/types/supabase";

// Zod schema for channel points template
const channelPointsTemplateSchema = z.object({
  title: z.string().min(1, "Title is required").max(45, "Title must be 45 characters or less"),
  cost: z.number().int().min(1, "Cost must be at least 1").max(2000000, "Cost is too high"),
  background_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color")
    .optional()
    .or(z.literal("")),
  prompt: z.string().max(200, "Prompt must be 200 characters or less").optional().or(z.literal("")),
  is_enabled: z.boolean(),
  is_user_input_required: z.boolean(),
  is_global_cooldown_enabled: z.boolean(),
  global_cooldown_seconds: z.number().int().min(0).max(86400).optional(),
  is_max_per_stream_enabled: z.boolean(),
  max_per_stream: z.number().int().min(1).optional(),
  is_max_per_user_per_stream_enabled: z.boolean(),
  max_per_user_per_stream: z.number().int().min(1).optional(),
  should_redemptions_skip_request_queue: z.boolean(),
  action: z.string().optional(),
});

type ChannelPointsTemplateFormValues = z.infer<typeof channelPointsTemplateSchema>;
type Action = Database["public"]["Tables"]["smp_actions"]["Row"];

interface ChannelPointsTemplateFormProps {
  id?: string;
  defaultValues?: Partial<ChannelPointsTemplateFormValues>;
}

export function ChannelPointsTemplateForm({ id, defaultValues }: ChannelPointsTemplateFormProps) {
  const router = useRouter();
  const [actions, setActions] = useState<Action[]>([]);
  const [loadingActions, setLoadingActions] = useState(true);

  const form = useForm<ChannelPointsTemplateFormValues>({
    resolver: zodResolver(channelPointsTemplateSchema),
    defaultValues: {
      title: defaultValues?.title ?? "",
      cost: defaultValues?.cost ?? 100,
      background_color: defaultValues?.background_color ?? "",
      prompt: defaultValues?.prompt ?? "",
      is_enabled: defaultValues?.is_enabled ?? true,
      is_user_input_required: defaultValues?.is_user_input_required ?? false,
      is_global_cooldown_enabled: defaultValues?.is_global_cooldown_enabled ?? false,
      global_cooldown_seconds: defaultValues?.global_cooldown_seconds ?? 0,
      is_max_per_stream_enabled: defaultValues?.is_max_per_stream_enabled ?? false,
      max_per_stream: defaultValues?.max_per_stream ?? 1,
      is_max_per_user_per_stream_enabled: defaultValues?.is_max_per_user_per_stream_enabled ?? false,
      max_per_user_per_stream: defaultValues?.max_per_user_per_stream ?? 1,
      should_redemptions_skip_request_queue: defaultValues?.should_redemptions_skip_request_queue ?? false,
      action: defaultValues?.action ?? undefined,
    },
  });

  const watchGlobalCooldownEnabled = form.watch("is_global_cooldown_enabled");
  const watchMaxPerStreamEnabled = form.watch("is_max_per_stream_enabled");
  const watchMaxPerUserPerStreamEnabled = form.watch("is_max_per_user_per_stream_enabled");

  useEffect(() => {
    async function fetchActions() {
      const result = await getAllActions();
      if (result && Array.isArray(result)) {
        setActions(result);
      }
      setLoadingActions(false);
    }
    fetchActions();
  }, []);

  async function handleSubmit(values: ChannelPointsTemplateFormValues) {
    console.log("Form submitted:", values);
    if (id) {
      const res = await updateChannelPointsTemplate(id, values);
      if (!res) {
        toast.error("Failed to update channel points template");
        return;
      }
      toast.success("Channel points template updated successfully");
    } else {
      const res = await createChannelPointsTemplate(values);
      if (!res) {
        toast.error("Failed to create channel points template");
        return;
      }
      toast.success("Channel points template created successfully");
    }
    router.push("/dashboard/smp/admin/channel-points");
  }

  return (
    <form id="channelpoints-template-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Configure the basic details of your channel points reward</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {/* Title */}
            <Controller
              name="title"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="channelpoints-title">Title</FieldLabel>
                  <Input {...field} id="channelpoints-title" aria-invalid={fieldState.invalid} placeholder="Enter reward title" />
                  <FieldDescription>The name viewers will see for this reward (max 45 characters)</FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            {/* Cost */}
            <Controller
              name="cost"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="channelpoints-cost">Cost</FieldLabel>
                  <Input
                    {...field}
                    id="channelpoints-cost"
                    type="number"
                    aria-invalid={fieldState.invalid}
                    placeholder="100"
                    min={1}
                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                  />
                  <FieldDescription>The number of channel points required to redeem this reward</FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            {/* Background Color */}
            <Controller
              name="background_color"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="channelpoints-color">Background Color (Optional)</FieldLabel>
                  <div className="flex gap-2">
                    <Input {...field} type="color" className="w-20 h-10 cursor-pointer" aria-invalid={fieldState.invalid} />
                    <Input
                      {...field}
                      id="channelpoints-color"
                      type="text"
                      placeholder="#9147FF"
                      className="flex-1"
                      aria-invalid={fieldState.invalid}
                    />
                  </div>
                  <FieldDescription>Custom background color for the reward (hex format)</FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            {/* Prompt */}
            <Controller
              name="prompt"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="channelpoints-prompt">Prompt (Optional)</FieldLabel>
                  <Textarea
                    {...field}
                    id="channelpoints-prompt"
                    aria-invalid={fieldState.invalid}
                    placeholder="Ask viewers for more information when they redeem this reward"
                    className="resize-none"
                  />
                  <FieldDescription>A prompt for viewers (max 200 characters)</FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            {/* Action */}
            <Controller
              name="action"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="channelpoints-action">Action (Optional)</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={loadingActions}>
                    <SelectTrigger id="channelpoints-action" aria-invalid={fieldState.invalid}>
                      <SelectValue placeholder={loadingActions ? "Loading actions..." : "Select an action"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {actions.map((action) => (
                        <SelectItem key={action.id} value={action.id}>
                          {action.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>Choose an action to trigger when this reward is redeemed</FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Configure how viewers interact with this reward</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {/* Enable Reward */}
            <Controller
              name="is_enabled"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field orientation="horizontal" data-invalid={fieldState.invalid} className="rounded-lg border p-4">
                  <FieldContent>
                    <FieldLabel htmlFor="channelpoints-enabled" className="text-base">
                      Enable Reward
                    </FieldLabel>
                    <FieldDescription>Make this reward available for redemption</FieldDescription>
                  </FieldContent>
                  <Switch
                    id="channelpoints-enabled"
                    name={field.name}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-invalid={fieldState.invalid}
                  />
                </Field>
              )}
            />

            {/* Require User Input */}
            <Controller
              name="is_user_input_required"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field orientation="horizontal" data-invalid={fieldState.invalid} className="rounded-lg border p-4">
                  <FieldContent>
                    <FieldLabel htmlFor="channelpoints-user-input" className="text-base">
                      Require User Input
                    </FieldLabel>
                    <FieldDescription>Require viewers to enter text when redeeming</FieldDescription>
                  </FieldContent>
                  <Switch
                    id="channelpoints-user-input"
                    name={field.name}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-invalid={fieldState.invalid}
                  />
                </Field>
              )}
            />

            {/* Skip Request Queue */}
            <Controller
              name="should_redemptions_skip_request_queue"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field orientation="horizontal" data-invalid={fieldState.invalid} className="rounded-lg border p-4">
                  <FieldContent>
                    <FieldLabel htmlFor="channelpoints-skip-queue" className="text-base">
                      Skip Request Queue
                    </FieldLabel>
                    <FieldDescription>Automatically approve redemptions without review</FieldDescription>
                  </FieldContent>
                  <Switch
                    id="channelpoints-skip-queue"
                    name={field.name}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-invalid={fieldState.invalid}
                  />
                </Field>
              )}
            />
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Cooldowns & Limits */}
      <Card>
        <CardHeader>
          <CardTitle>Cooldowns & Limits</CardTitle>
          <CardDescription>Set cooldowns and redemption limits for this reward</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {/* Global Cooldown Toggle */}
            <Controller
              name="is_global_cooldown_enabled"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field orientation="horizontal" data-invalid={fieldState.invalid} className="rounded-lg border p-4">
                  <FieldContent>
                    <FieldLabel htmlFor="channelpoints-global-cooldown" className="text-base">
                      Global Cooldown
                    </FieldLabel>
                    <FieldDescription>Add a cooldown between redemptions from all viewers</FieldDescription>
                  </FieldContent>
                  <Switch
                    id="channelpoints-global-cooldown"
                    name={field.name}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-invalid={fieldState.invalid}
                  />
                </Field>
              )}
            />

            {/* Global Cooldown Duration */}
            {watchGlobalCooldownEnabled && (
              <Controller
                name="global_cooldown_seconds"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="ml-4">
                    <FieldLabel htmlFor="channelpoints-cooldown-seconds">Cooldown Duration (seconds)</FieldLabel>
                    <Input
                      {...field}
                      id="channelpoints-cooldown-seconds"
                      type="number"
                      aria-invalid={fieldState.invalid}
                      placeholder="60"
                      min={0}
                      max={86400}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                    <FieldDescription>Time in seconds before this reward can be redeemed again (max 24 hours)</FieldDescription>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            )}

            <FieldSeparator />

            {/* Max Per Stream Toggle */}
            <Controller
              name="is_max_per_stream_enabled"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field orientation="horizontal" data-invalid={fieldState.invalid} className="rounded-lg border p-4">
                  <FieldContent>
                    <FieldLabel htmlFor="channelpoints-max-stream" className="text-base">
                      Max Per Stream
                    </FieldLabel>
                    <FieldDescription>Limit how many times this reward can be redeemed per stream</FieldDescription>
                  </FieldContent>
                  <Switch
                    id="channelpoints-max-stream"
                    name={field.name}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-invalid={fieldState.invalid}
                  />
                </Field>
              )}
            />

            {/* Max Per Stream Value */}
            {watchMaxPerStreamEnabled && (
              <Controller
                name="max_per_stream"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="ml-4">
                    <FieldLabel htmlFor="channelpoints-max-stream-value">Maximum Redemptions</FieldLabel>
                    <Input
                      {...field}
                      id="channelpoints-max-stream-value"
                      type="number"
                      aria-invalid={fieldState.invalid}
                      placeholder="10"
                      min={1}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                    <FieldDescription>Total number of times this reward can be redeemed per stream</FieldDescription>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            )}

            <FieldSeparator />

            {/* Max Per User Per Stream Toggle */}
            <Controller
              name="is_max_per_user_per_stream_enabled"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field orientation="horizontal" data-invalid={fieldState.invalid} className="rounded-lg border p-4">
                  <FieldContent>
                    <FieldLabel htmlFor="channelpoints-max-user-stream" className="text-base">
                      Max Per User Per Stream
                    </FieldLabel>
                    <FieldDescription>Limit redemptions per viewer per stream</FieldDescription>
                  </FieldContent>
                  <Switch
                    id="channelpoints-max-user-stream"
                    name={field.name}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    aria-invalid={fieldState.invalid}
                  />
                </Field>
              )}
            />

            {/* Max Per User Per Stream Value */}
            {watchMaxPerUserPerStreamEnabled && (
              <Controller
                name="max_per_user_per_stream"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="ml-4">
                    <FieldLabel htmlFor="channelpoints-max-user-stream-value">Maximum Redemptions Per User</FieldLabel>
                    <Input
                      {...field}
                      id="channelpoints-max-user-stream-value"
                      type="number"
                      aria-invalid={fieldState.invalid}
                      placeholder="1"
                      min={1}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                    <FieldDescription>Number of times each viewer can redeem this reward per stream</FieldDescription>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            )}
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Submit Buttons */}
      <Card>
        <CardFooter className="flex justify-end gap-4 pt-6">
          <Button type="button" variant="outline" onClick={() => form.reset()}>
            Reset
          </Button>
          <Button type="submit" form="channelpoints-template-form">
            {id ? "Update Template" : "Create Template"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
