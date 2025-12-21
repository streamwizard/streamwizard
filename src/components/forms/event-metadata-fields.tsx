"use client";

import { Control, Controller } from "react-hook-form";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { ActionCategory, ACTION_CATEGORIES, getEvent } from "@/lib/actions/action-registry";

interface EventMetadataFieldsProps {
  category: ActionCategory;
  eventId: string;
  control: Control<any>;
}

/**
 * Dynamic metadata fields component based on category and event
 */
export function EventMetadataFields({ category, eventId, control }: EventMetadataFieldsProps) {
  if (!category || !eventId) {
    return null;
  }

  const event = getEvent(category, eventId);
  if (!event) {
    return null;
  }

  // Render fields based on category
  switch (category) {
    case ACTION_CATEGORIES.JUMPSCARES:
      return <JumpscareFields eventId={eventId} control={control} />;
    case ACTION_CATEGORIES.SOUNDS:
      return <SoundFields eventId={eventId} control={control} />;
    case ACTION_CATEGORIES.MESSAGES:
      return <MessageFields eventId={eventId} control={control} />;
    case ACTION_CATEGORIES.WEBHOOKS:
      return <WebhookFields control={control} />;
    case ACTION_CATEGORIES.COMMANDS:
      return <CommandFields control={control} />;
    case ACTION_CATEGORIES.VARIABLES:
      return <VariableFields control={control} />;
    default:
      return null;
  }
}

// Jumpscare Fields
function JumpscareFields({ eventId, control }: { eventId: string; control: Control<any> }) {
  if (eventId === "custom_jumpscare") {
    return (
      <FieldGroup>
        <Controller
          name="metadata.imageUrl"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="metadata-imageUrl">Image URL *</FieldLabel>
              <Input {...field} value={field.value || ""} id="metadata-imageUrl" type="url" placeholder="https://example.com/jumpscare.png" />
              <FieldDescription>URL to the jumpscare image</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="metadata.soundUrl"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="metadata-soundUrl">Sound URL (Optional)</FieldLabel>
              <Input {...field} value={field.value || ""} id="metadata-soundUrl" type="url" placeholder="https://example.com/scream.mp3" />
              <FieldDescription>URL to the sound effect</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="metadata.duration"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="metadata-duration">Duration (ms)</FieldLabel>
              <Input
                {...field}
                value={field.value ?? 0}
                id="metadata-duration"
                type="number"
                min={100}
                max={10000}
                onChange={(e) => field.onChange(e.target.valueAsNumber)}
              />
              <FieldDescription>How long the jumpscare lasts (milliseconds)</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="metadata.intensity"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="metadata-intensity">Intensity</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="metadata-intensity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>Intensity level of the effect</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="metadata.screenShake"
          control={control}
          render={({ field, fieldState }) => (
            <Field orientation="horizontal" data-invalid={fieldState.invalid} className="rounded-lg border p-4">
              <div>
                <FieldLabel htmlFor="metadata-screenShake">Screen Shake</FieldLabel>
                <FieldDescription>Enable screen shake effect</FieldDescription>
              </div>
              <Switch id="metadata-screenShake" checked={field.value} onCheckedChange={field.onChange} />
            </Field>
          )}
        />
      </FieldGroup>
    );
  }

  // Default jumpscare fields (welcome_home, freddy_fazbear, etc.)
  return (
    <FieldGroup>
      <Controller
        name="metadata.duration"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="metadata-duration">Duration (ms)</FieldLabel>
            <Input
              {...field}
              id="metadata-duration"
              type="number"
              min={100}
              max={10000}
              onChange={(e) => field.onChange(e.target.valueAsNumber)}
            />
            <FieldDescription>How long the jumpscare lasts (milliseconds)</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      {eventId !== "freddy_fazbear" && (
        <Controller
          name="metadata.intensity"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="metadata-intensity">Intensity</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="metadata-intensity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>Intensity level of the effect</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      )}
      <Controller
        name="metadata.soundEnabled"
        control={control}
        render={({ field, fieldState }) => (
          <Field orientation="horizontal" data-invalid={fieldState.invalid} className="rounded-lg border p-4">
            <div>
              <FieldLabel htmlFor="metadata-soundEnabled">Sound Enabled</FieldLabel>
              <FieldDescription>Play sound effect with jumpscare</FieldDescription>
            </div>
            <Switch id="metadata-soundEnabled" checked={field.value} onCheckedChange={field.onChange} />
          </Field>
        )}
      />
      {eventId === "freddy_fazbear" && (
        <Controller
          name="metadata.screenShake"
          control={control}
          render={({ field, fieldState }) => (
            <Field orientation="horizontal" data-invalid={fieldState.invalid} className="rounded-lg border p-4">
              <div>
                <FieldLabel htmlFor="metadata-screenShake">Screen Shake</FieldLabel>
                <FieldDescription>Enable screen shake effect</FieldDescription>
              </div>
              <Switch id="metadata-screenShake" checked={field.value} onCheckedChange={field.onChange} />
            </Field>
          )}
        />
      )}
      {eventId === "welcome_home" && (
        <Controller
          name="metadata.imageUrl"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="metadata-imageUrl">Custom Image URL (Optional)</FieldLabel>
              <Input {...field} value={field.value || ""} id="metadata-imageUrl" type="url" placeholder="https://example.com/image.png" />
              <FieldDescription>Override default image</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      )}
    </FieldGroup>
  );
}

// Sound Fields
function SoundFields({ eventId, control }: { eventId: string; control: Control<any> }) {
  if (eventId === "text_to_speech") {
    return (
      <FieldGroup>
        <Controller
          name="metadata.text"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="metadata-text">Text *</FieldLabel>
              <Textarea {...field} id="metadata-text" placeholder="Enter text to speak" className="resize-none" rows={3} />
              <FieldDescription>Text to convert to speech</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="metadata.voice"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="metadata-voice">Voice</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="metadata-voice">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="robot">Robot</SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>Voice type for speech</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="metadata.speed"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="metadata-speed">Speed</FieldLabel>
              <Input
                {...field}
                id="metadata-speed"
                type="number"
                step={0.1}
                min={0.5}
                max={2}
                onChange={(e) => field.onChange(e.target.valueAsNumber)}
              />
              <FieldDescription>Speech speed (0.5 - 2.0)</FieldDescription>
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
                onChange={(e) => field.onChange(e.target.valueAsNumber)}
              />
              <FieldDescription>Volume level</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>
    );
  }

  // Play audio fields
  return (
    <FieldGroup>
      <Controller
        name="metadata.audioUrl"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="metadata-audioUrl">Audio URL *</FieldLabel>
            <Input {...field} value={field.value || ""} id="metadata-audioUrl" type="url" placeholder="https://example.com/sound.mp3" />
            <FieldDescription>URL to the audio file</FieldDescription>
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
              onChange={(e) => field.onChange(e.target.valueAsNumber)}
            />
            <FieldDescription>Volume level</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="metadata.loop"
        control={control}
        render={({ field, fieldState }) => (
          <Field orientation="horizontal" data-invalid={fieldState.invalid} className="rounded-lg border p-4">
            <div>
              <FieldLabel htmlFor="metadata-loop">Loop</FieldLabel>
              <FieldDescription>Loop the audio</FieldDescription>
            </div>
            <Switch id="metadata-loop" checked={field.value} onCheckedChange={field.onChange} />
          </Field>
        )}
      />
      <Controller
        name="metadata.fadeIn"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="metadata-fadeIn">Fade In (ms)</FieldLabel>
            <Input
              {...field}
              id="metadata-fadeIn"
              type="number"
              min={0}
              max={5000}
              onChange={(e) => field.onChange(e.target.valueAsNumber)}
            />
            <FieldDescription>Fade in duration</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="metadata.fadeOut"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="metadata-fadeOut">Fade Out (ms)</FieldLabel>
            <Input
              {...field}
              id="metadata-fadeOut"
              type="number"
              min={0}
              max={5000}
              onChange={(e) => field.onChange(e.target.valueAsNumber)}
            />
            <FieldDescription>Fade out duration</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
    </FieldGroup>
  );
}

// Message Fields
function MessageFields({ eventId, control }: { eventId: string; control: Control<any> }) {
  if (eventId === "announcement") {
    return (
      <FieldGroup>
        <Controller
          name="metadata.message"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="metadata-message">Message *</FieldLabel>
              <Textarea {...field} id="metadata-message" placeholder="Enter announcement message" className="resize-none" rows={3} />
              <FieldDescription>Announcement message content</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="metadata.color"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="metadata-color">Color</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="metadata-color">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blue">Blue</SelectItem>
                  <SelectItem value="green">Green</SelectItem>
                  <SelectItem value="orange">Orange</SelectItem>
                  <SelectItem value="purple">Purple</SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>Announcement color</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>
    );
  }

  // Chat message fields
  return (
    <FieldGroup>
      <Controller
        name="metadata.message"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="metadata-message">Message *</FieldLabel>
            <Textarea {...field} id="metadata-message" placeholder="Enter message to send" className="resize-none" rows={3} />
            <FieldDescription>Message to send to chat</FieldDescription>
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
              onChange={(e) => field.onChange(e.target.valueAsNumber)}
            />
            <FieldDescription>Delay before sending message</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="metadata.replyToRedemption"
        control={control}
        render={({ field, fieldState }) => (
          <Field orientation="horizontal" data-invalid={fieldState.invalid} className="rounded-lg border p-4">
            <div>
              <FieldLabel htmlFor="metadata-replyToRedemption">Reply to Redemption</FieldLabel>
              <FieldDescription>Reply to the channel points redemption message</FieldDescription>
            </div>
            <Switch id="metadata-replyToRedemption" checked={field.value} onCheckedChange={field.onChange} />
          </Field>
        )}
      />
    </FieldGroup>
  );
}

// Webhook Fields
function WebhookFields({ control }: { control: Control<any> }) {
  return (
    <FieldGroup>
      <Controller
        name="metadata.webhookUrl"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="metadata-webhookUrl">Webhook URL *</FieldLabel>
            <Input {...field} value={field.value || ""} id="metadata-webhookUrl" type="url" placeholder="https://api.example.com/webhook" />
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
                <SelectValue />
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

// Command Fields
function CommandFields({ control }: { control: Control<any> }) {
  return (
    <FieldGroup>
      <Controller
        name="metadata.command"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="metadata-command">Command *</FieldLabel>
            <Input {...field} value={field.value || ""} id="metadata-command" placeholder="e.g., /usr/bin/script.sh" />
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
            <Input {...field} value={field.value || ""} id="metadata-arguments" placeholder="e.g., --flag value" />
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
              onChange={(e) => field.onChange(e.target.valueAsNumber)}
            />
            <FieldDescription>Maximum execution time (0-300 seconds)</FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <Controller
        name="metadata.runAsAdmin"
        control={control}
        render={({ field, fieldState }) => (
          <Field orientation="horizontal" data-invalid={fieldState.invalid} className="rounded-lg border p-4">
            <div>
              <FieldLabel htmlFor="metadata-runAsAdmin">Run as Administrator</FieldLabel>
              <FieldDescription>Execute command with elevated privileges</FieldDescription>
            </div>
            <Switch id="metadata-runAsAdmin" checked={field.value} onCheckedChange={field.onChange} />
          </Field>
        )}
      />
    </FieldGroup>
  );
}

// Variable Fields
function VariableFields({ control }: { control: Control<any> }) {
  return (
    <FieldGroup>
      <Controller
        name="metadata.variableName"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="metadata-variableName">Variable Name *</FieldLabel>
            <Input {...field} value={field.value || ""} id="metadata-variableName" placeholder="e.g., counter, score" />
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
            <Input {...field} value={field.value || ""} id="metadata-value" placeholder="e.g., 1, hello" />
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
                <SelectValue />
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

