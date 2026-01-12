"use client";

import { useState } from "react";
import { Controller } from "react-hook-form";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { IconBraces } from "@tabler/icons-react";
import { MetadataFieldsProps, NumberFieldWithSlider } from "../types";
import { TriggerVariablesModal } from "../../trigger-variables-modal";

export function CelebrationAlertFields({ eventId, control, triggerEventType }: MetadataFieldsProps) {
  const [variablesModalOpen, setVariablesModalOpen] = useState(false);
  const [activeField, setActiveField] = useState<"title" | "subtitle" | "message" | null>(null);
  const [fieldRefs, setFieldRefs] = useState<{
    title?: HTMLInputElement;
    subtitle?: HTMLInputElement;
    message?: HTMLTextAreaElement;
  }>({});

  const handleOpenVariables = (field: "title" | "subtitle" | "message", ref: HTMLInputElement | HTMLTextAreaElement) => {
    setActiveField(field);
    setFieldRefs((prev) => ({ ...prev, [field]: ref }));
    setVariablesModalOpen(true);
  };

  const handleInsertVariable = (variable: string) => {
    if (activeField && fieldRefs[activeField]) {
      const input = fieldRefs[activeField];
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const currentValue = input.value || "";
      const newValue = currentValue.substring(0, start) + variable + currentValue.substring(end);
      
      // Trigger onChange event
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set || Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(input, newValue);
        const event = new Event("input", { bubbles: true });
        input.dispatchEvent(event);
      }
      
      // Set cursor position after inserted variable
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    }
  };
  return (
    <FieldGroup>
      <Controller
        name="metadata.color"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="metadata-color">Custom Color (Optional)</FieldLabel>
            <div className="flex gap-2">
              <Input 
                type="color" 
                {...field} 
                value={field.value ?? "#FFFF00"} 
                id="metadata-color" 
                className="w-20 h-10"
              />
              <Input 
                type="text" 
                value={field.value ?? ""} 
                onChange={(e) => field.onChange(e.target.value)}
                placeholder="#FFFF00"
                maxLength={7}
                className="flex-1"
              />
            </div>
            <FieldDescription>Custom hex color for fireworks/effects (RGB or RRGGBB format)</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="metadata.enable_fireworks"
        control={control}
        render={({ field, fieldState }) => (
          <Field orientation="horizontal" data-invalid={fieldState.invalid} className="rounded-lg border p-4">
            <div>
              <FieldLabel htmlFor="metadata-enable_fireworks">Enable Fireworks</FieldLabel>
              <FieldDescription>Enable/disable fireworks for this celebration</FieldDescription>
            </div>
            <Switch id="metadata-enable_fireworks" checked={field.value ?? true} onCheckedChange={field.onChange} />
          </Field>
        )}
      />
      <Controller
        name="metadata.fireworks"
        control={control}
        render={({ field, fieldState }) => (
          <NumberFieldWithSlider
            field={field}
            fieldState={fieldState}
            label="Fireworks Count"
            id="metadata-fireworks"
            min={1}
            max={10}
            step={1}
            defaultValue={3}
            description="Number of fireworks to spawn (1-10)"
          />
        )}
      />
      <Controller
        name="metadata.intensity"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="metadata-intensity">Intensity</FieldLabel>
            <Select value={field.value ?? "normal"} onValueChange={field.onChange}>
              <SelectTrigger id="metadata-intensity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="extreme">Extreme</SelectItem>
              </SelectContent>
            </Select>
            <FieldDescription>Celebration intensity level</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="metadata.duration"
        control={control}
        render={({ field, fieldState }) => (
          <NumberFieldWithSlider
            field={field}
            fieldState={fieldState}
            label="Duration (seconds)"
            id="metadata-duration-celebration"
            min={1}
            max={10}
            step={1}
            defaultValue={5}
            description="How long the celebration lasts (1-10 seconds)"
          />
        )}
      />
      <Controller
        name="metadata.title"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <div className="flex items-center justify-between mb-2">
              <FieldLabel htmlFor="metadata-title">Title (Optional)</FieldLabel>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  const input = document.getElementById("metadata-title") as HTMLInputElement;
                  if (input) handleOpenVariables("title", input);
                }}
                disabled={!triggerEventType}
                className="h-7"
              >
                <IconBraces className="h-4 w-4 mr-1" />
                Variables
              </Button>
            </div>
            <Input {...field} value={field.value ?? ""} id="metadata-title" maxLength={100} />
            <FieldDescription>Custom title text (overrides defaults, max 100 characters)</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="metadata.subtitle"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <div className="flex items-center justify-between mb-2">
              <FieldLabel htmlFor="metadata-subtitle">Subtitle (Optional)</FieldLabel>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  const input = document.getElementById("metadata-subtitle") as HTMLInputElement;
                  if (input) handleOpenVariables("subtitle", input);
                }}
                disabled={!triggerEventType}
                className="h-7"
              >
                <IconBraces className="h-4 w-4 mr-1" />
                Variables
              </Button>
            </div>
            <Input {...field} value={field.value ?? ""} id="metadata-subtitle" maxLength={100} />
            <FieldDescription>Custom subtitle text (overrides defaults, max 100 characters)</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="metadata.message"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <div className="flex items-center justify-between mb-2">
              <FieldLabel htmlFor="metadata-message">Message (Optional)</FieldLabel>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  const input = document.getElementById("metadata-message") as HTMLTextAreaElement;
                  if (input) handleOpenVariables("message", input);
                }}
                disabled={!triggerEventType}
                className="h-7"
              >
                <IconBraces className="h-4 w-4 mr-1" />
                Variables
              </Button>
            </div>
            <Textarea
              {...field}
              value={field.value ?? ""}
              id="metadata-message"
              className="resize-none"
              rows={2}
              maxLength={500}
            />
            <FieldDescription>Custom chat message (overrides defaults, max 500 characters)</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="metadata.show_chat"
        control={control}
        render={({ field, fieldState }) => (
          <Field orientation="horizontal" data-invalid={fieldState.invalid} className="rounded-lg border p-4">
            <div>
              <FieldLabel htmlFor="metadata-show_chat">Show in Chat</FieldLabel>
              <FieldDescription>Display message in chat</FieldDescription>
            </div>
            <Switch id="metadata-show_chat" checked={field.value ?? true} onCheckedChange={field.onChange} />
          </Field>
        )}
      />
      <Controller
        name="metadata.show_title"
        control={control}
        render={({ field, fieldState }) => (
          <Field orientation="horizontal" data-invalid={fieldState.invalid} className="rounded-lg border p-4">
            <div>
              <FieldLabel htmlFor="metadata-show_title">Show Title</FieldLabel>
              <FieldDescription>Display title on screen</FieldDescription>
            </div>
            <Switch id="metadata-show_title" checked={field.value ?? true} onCheckedChange={field.onChange} />
          </Field>
        )}
      />
      <Controller
        name="metadata.broadcast"
        control={control}
        render={({ field, fieldState }) => (
          <Field orientation="horizontal" data-invalid={fieldState.invalid} className="rounded-lg border p-4">
            <div>
              <FieldLabel htmlFor="metadata-broadcast">Broadcast</FieldLabel>
              <FieldDescription>Broadcast to all players</FieldDescription>
            </div>
            <Switch id="metadata-broadcast" checked={field.value ?? false} onCheckedChange={field.onChange} />
          </Field>
        )}
      />
      <Controller
        name="metadata.enable_sounds"
        control={control}
        render={({ field, fieldState }) => (
          <Field orientation="horizontal" data-invalid={fieldState.invalid} className="rounded-lg border p-4">
            <div>
              <FieldLabel htmlFor="metadata-enable_sounds">Enable Sounds</FieldLabel>
              <FieldDescription>Enable/disable all sounds for this celebration</FieldDescription>
            </div>
            <Switch id="metadata-enable_sounds" checked={field.value ?? true} onCheckedChange={field.onChange} />
          </Field>
        )}
      />
      <Controller
        name="metadata.volume"
        control={control}
        render={({ field, fieldState }) => (
          <NumberFieldWithSlider
            field={field}
            fieldState={fieldState}
            label="Volume"
            id="metadata-volume-celebration"
            min={0.0}
            max={2.0}
            step={0.1}
            defaultValue={1.0}
            description="Sound volume (0.0-2.0)"
          />
        )}
      />

      {/* Variables Modal */}
      <TriggerVariablesModal
        open={variablesModalOpen}
        onOpenChange={setVariablesModalOpen}
        triggerEventType={triggerEventType}
        onInsertVariable={handleInsertVariable}
      />
    </FieldGroup>
  );
}
