"use client";

import { Control, Controller } from "react-hook-form";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { ACTION_TYPES, ActionType } from "@/lib/actions/action-types";

interface MetadataFieldsProps {
  actionType: ActionType;
  control: Control<any>;
}

/**
 * Dynamic metadata fields component
 * Renders different fields based on the selected action type
 */
export function MetadataFields({ actionType, control }: MetadataFieldsProps) {
  if (!actionType) {
    return null;
  }

  switch (actionType) {
    case ACTION_TYPES.SEND_MESSAGE:
      return <SendMessageFields control={control} />;
    case ACTION_TYPES.PLAY_SOUND:
      return <PlaySoundFields control={control} />;
    case ACTION_TYPES.EXECUTE_COMMAND:
      return <ExecuteCommandFields control={control} />;
    case ACTION_TYPES.TRIGGER_WEBHOOK:
      return <TriggerWebhookFields control={control} />;
    case ACTION_TYPES.UPDATE_VARIABLE:
      return <UpdateVariableFields control={control} />;
    default:
      return null;
  }
}

// Send Message Fields
function SendMessageFields({ control }: { control: Control<any> }) {
  return (
    <FieldGroup>
      <Controller
        name="metadata.message"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="metadata-message">Message *</FieldLabel>
            <Textarea
              {...field}
              id="metadata-message"
              placeholder="Enter the message to send"
              className="resize-none"
              rows={3}
            />
            <FieldDescription>The message that will be sent to chat</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="metadata.channel"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="metadata-channel">Channel (Optional)</FieldLabel>
            <Input {...field} id="metadata-channel" placeholder="e.g., #general" />
            <FieldDescription>Specific channel to send the message to</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="metadata.delay"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="metadata-delay">Delay (seconds)</FieldLabel>
            <Input
              {...field}
              id="metadata-delay"
              type="number"
              min={0}
              max={3600}
              placeholder="0"
              onChange={(e) => field.onChange(e.target.valueAsNumber)}
            />
            <FieldDescription>Delay before sending the message (0-3600 seconds)</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
    </FieldGroup>
  );
}

// Play Sound Fields
function PlaySoundFields({ control }: { control: Control<any> }) {
  return (
    <FieldGroup>
      <Controller
        name="metadata.soundUrl"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="metadata-soundUrl">Sound URL *</FieldLabel>
            <Input {...field} id="metadata-soundUrl" type="url" placeholder="https://example.com/sound.mp3" />
            <FieldDescription>URL to the sound file</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="metadata.volume"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="metadata-volume">Volume (0-100)</FieldLabel>
            <Input
              {...field}
              id="metadata-volume"
              type="number"
              min={0}
              max={100}
              placeholder="50"
              onChange={(e) => field.onChange(e.target.valueAsNumber)}
            />
            <FieldDescription>Volume level (0-100, default: 50)</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="metadata.duration"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="metadata-duration">Duration (seconds)</FieldLabel>
            <Input
              {...field}
              id="metadata-duration"
              type="number"
              min={0}
              max={60}
              placeholder="0"
              onChange={(e) => field.onChange(e.target.valueAsNumber)}
            />
            <FieldDescription>Maximum duration to play (0 = full length)</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
    </FieldGroup>
  );
}

// Execute Command Fields
function ExecuteCommandFields({ control }: { control: Control<any> }) {
  return (
    <FieldGroup>
      <Controller
        name="metadata.command"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="metadata-command">Command *</FieldLabel>
            <Input {...field} id="metadata-command" placeholder="e.g., /usr/bin/script.sh" />
            <FieldDescription>The command or script to execute</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="metadata.arguments"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="metadata-arguments">Arguments (Optional)</FieldLabel>
            <Input {...field} id="metadata-arguments" placeholder="e.g., --flag value" />
            <FieldDescription>Command line arguments</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="metadata.timeout"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="metadata-timeout">Timeout (seconds)</FieldLabel>
            <Input
              {...field}
              id="metadata-timeout"
              type="number"
              min={0}
              max={300}
              placeholder="30"
              onChange={(e) => field.onChange(e.target.valueAsNumber)}
            />
            <FieldDescription>Maximum execution time (0-300 seconds)</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
    </FieldGroup>
  );
}

// Trigger Webhook Fields
function TriggerWebhookFields({ control }: { control: Control<any> }) {
  return (
    <FieldGroup>
      <Controller
        name="metadata.webhookUrl"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="metadata-webhookUrl">Webhook URL *</FieldLabel>
            <Input {...field} id="metadata-webhookUrl" type="url" placeholder="https://api.example.com/webhook" />
            <FieldDescription>The webhook endpoint URL</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="metadata.method"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="metadata-method">HTTP Method</FieldLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="metadata-method">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="PATCH">PATCH</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectContent>
            </Select>
            <FieldDescription>HTTP method to use</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="metadata.headers"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="metadata-headers">Headers (JSON, Optional)</FieldLabel>
            <Textarea
              {...field}
              id="metadata-headers"
              placeholder='{"Authorization": "Bearer token"}'
              className="resize-none font-mono text-sm"
              rows={3}
            />
            <FieldDescription>Custom HTTP headers as JSON</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="metadata.body"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="metadata-body">Body (JSON, Optional)</FieldLabel>
            <Textarea
              {...field}
              id="metadata-body"
              placeholder='{"key": "value"}'
              className="resize-none font-mono text-sm"
              rows={4}
            />
            <FieldDescription>Request body as JSON</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
    </FieldGroup>
  );
}

// Update Variable Fields
function UpdateVariableFields({ control }: { control: Control<any> }) {
  return (
    <FieldGroup>
      <Controller
        name="metadata.variableName"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="metadata-variableName">Variable Name *</FieldLabel>
            <Input {...field} id="metadata-variableName" placeholder="e.g., counter, score" />
            <FieldDescription>Name of the variable to update</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="metadata.value"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="metadata-value">Value *</FieldLabel>
            <Input {...field} id="metadata-value" placeholder="e.g., 1, hello" />
            <FieldDescription>The value to set or use in the operation</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="metadata.operation"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="metadata-operation">Operation</FieldLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="metadata-operation">
                <SelectValue placeholder="Select operation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="set">Set (replace value)</SelectItem>
                <SelectItem value="increment">Increment (add to value)</SelectItem>
                <SelectItem value="decrement">Decrement (subtract from value)</SelectItem>
                <SelectItem value="append">Append (add to end)</SelectItem>
              </SelectContent>
            </Select>
            <FieldDescription>How to update the variable</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
    </FieldGroup>
  );
}


