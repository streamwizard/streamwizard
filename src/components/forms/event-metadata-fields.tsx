"use client";

import { Control, Controller } from "react-hook-form";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "../ui/field";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";
import { Slider } from "../ui/slider";
import { ActionCategory, ACTION_CATEGORIES, getEvent } from "@/lib/actions/action-registry";
import { MobSelector } from "./mob-selector";

/**
 * Helper component for number fields with slider
 */
function NumberFieldWithSlider({
  field,
  fieldState,
  label,
  id,
  min,
  max,
  step = 1,
  defaultValue,
  description,
}: {
  field: any;
  fieldState: any;
  label: string;
  id: string;
  min: number;
  max: number;
  step?: number;
  defaultValue: number;
  description: string;
}) {
  const value = field.value ?? defaultValue;
  const isInteger = step === 1 && Number.isInteger(min) && Number.isInteger(max);

  return (
    <Field data-invalid={fieldState.invalid}>
      <div className="flex items-center justify-between mb-2">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <Input
          {...field}
          value={value}
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const numValue = step === 1 ? e.target.valueAsNumber : parseFloat(e.target.value);
            if (!isNaN(numValue)) {
              field.onChange(isInteger ? Math.round(numValue) : numValue);
            }
          }}
          className="w-20 h-8 text-sm"
        />
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(values) => {
          const newValue = values[0];
          field.onChange(isInteger ? Math.round(newValue) : newValue);
        }}
        className="w-full"
      />
      <FieldDescription>{description}</FieldDescription>
      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
    </Field>
  );
}

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
    case ACTION_CATEGORIES.DISASTERS:
      return <DisasterFields eventId={eventId} control={control} />;
    case ACTION_CATEGORIES.EVENTS:
      return <EventFields eventId={eventId} control={control} />;
    default:
      return null;
  }
}

// Jumpscare Fields
function JumpscareFields({ eventId, control }: { eventId: string; control: Control<any> }) {
  // Events with no metadata: door_scare, welcome_home, EndermanJumpscare, fireworks
  if (["door_scare", "welcome_home", "EndermanJumpscare", "fireworks"].includes(eventId)) {
    return (
      <FieldGroup>
        <p className="text-sm text-muted-foreground">This event has no configurable options.</p>
      </FieldGroup>
    );
  }

  // Fake Damage event
  if (eventId === "fake_damage") {
    return (
      <FieldGroup>
        <Controller
          name="metadata.damageAmount"
          control={control}
          render={({ field, fieldState }) => (
            <NumberFieldWithSlider
              field={field}
              fieldState={fieldState}
              label="Damage Amount"
              id="metadata-damageAmount"
              min={1}
              max={20}
              step={1}
              defaultValue={5}
              description="Amount of fake damage to apply (1-20)"
            />
          )}
        />
        <Controller
          name="metadata.duration"
          control={control}
          render={({ field, fieldState }) => (
            <NumberFieldWithSlider
              field={field}
              fieldState={fieldState}
              label="Duration (ticks)"
              id="metadata-duration"
              min={10}
              max={200}
              step={1}
              defaultValue={100}
              description="How long the fake damage lasts in ticks (10-200)"
            />
          )}
        />
      </FieldGroup>
    );
  }

  // Spinning Player event
  if (eventId === "SpinningPlayer") {
    return (
      <FieldGroup>
        <Controller
          name="metadata.rotations"
          control={control}
          render={({ field, fieldState }) => (
            <NumberFieldWithSlider
              field={field}
              fieldState={fieldState}
              label="Rotations"
              id="metadata-rotations"
              min={1}
              max={10}
              step={1}
              defaultValue={4}
              description="Number of rotations to perform (1-10)"
            />
          )}
        />
        <Controller
          name="metadata.speed"
          control={control}
          render={({ field, fieldState }) => (
            <NumberFieldWithSlider
              field={field}
              fieldState={fieldState}
              label="Speed (ticks)"
              id="metadata-speed"
              min={1}
              max={10}
              step={1}
              defaultValue={2}
              description="Ticks between rotations (1-10)"
            />
          )}
        />
      </FieldGroup>
    );
  }

  return null;
}

// Disaster Fields
function DisasterFields({ eventId, control }: { eventId: string; control: Control<any> }) {
  // Supernova event
  if (eventId === "supernova") {
    return (
      <FieldGroup>
        <Controller
          name="metadata.level"
          control={control}
          render={({ field, fieldState }) => (
            <NumberFieldWithSlider
              field={field}
              fieldState={fieldState}
              label="Level"
              id="metadata-level"
              min={1}
              max={10}
              step={1}
              defaultValue={1}
              description="Supernova intensity level (1-10)"
            />
          )}
        />
        <Controller
          name="metadata.sizeMultiplier"
          control={control}
          render={({ field, fieldState }) => (
            <NumberFieldWithSlider
              field={field}
              fieldState={fieldState}
              label="Size Multiplier"
              id="metadata-sizeMultiplier"
              min={0.1}
              max={5.0}
              step={0.1}
              defaultValue={1.0}
              description="Size multiplier for the explosion (0.1-5.0)"
            />
          )}
        />
        <Controller
          name="metadata.particleMultiplier"
          control={control}
          render={({ field, fieldState }) => (
            <NumberFieldWithSlider
              field={field}
              fieldState={fieldState}
              label="Particle Multiplier"
              id="metadata-particleMultiplier"
              min={0.1}
              max={5.0}
              step={0.1}
              defaultValue={1.0}
              description="Particle count multiplier (0.1-5.0)"
            />
          )}
        />
        <Controller
          name="metadata.fallSpeedMultiplier"
          control={control}
          render={({ field, fieldState }) => (
            <NumberFieldWithSlider
              field={field}
              fieldState={fieldState}
              label="Fall Speed Multiplier"
              id="metadata-fallSpeedMultiplier"
              min={0.1}
              max={5.0}
              step={0.1}
              defaultValue={1.0}
              description="Fall speed multiplier for particles (0.1-5.0)"
            />
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
              id="metadata-volume"
              min={0.0}
              max={2.0}
              step={0.1}
              defaultValue={1.0}
              description="Sound volume (0.0-2.0)"
            />
          )}
        />
        <Controller
          name="metadata.farParticles"
          control={control}
          render={({ field, fieldState }) => (
            <Field orientation="horizontal" data-invalid={fieldState.invalid} className="rounded-lg border p-4">
              <div>
                <FieldLabel htmlFor="metadata-farParticles">Far Particles</FieldLabel>
                <FieldDescription>Enable particles at far distances</FieldDescription>
              </div>
              <Switch id="metadata-farParticles" checked={field.value ?? true} onCheckedChange={field.onChange} />
            </Field>
          )}
        />
      </FieldGroup>
    );
  }

  // Windstorm event
  if (eventId === "windstorm") {
    return (
      <FieldGroup>
        <Controller
          name="metadata.level"
          control={control}
          render={({ field, fieldState }) => (
            <NumberFieldWithSlider
              field={field}
              fieldState={fieldState}
              label="Level"
              id="metadata-level"
              min={1}
              max={10}
              step={1}
              defaultValue={5}
              description="Windstorm intensity level (1-10)"
            />
          )}
        />
        <Controller
          name="metadata.force"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <div className="flex items-center justify-between mb-2">
                <FieldLabel htmlFor="metadata-force">Force (Optional)</FieldLabel>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  id="metadata-force"
                  type="number"
                  step={0.1}
                  min={0.1}
                  max={2.0}
                  onChange={(e) => field.onChange(e.target.value ? e.target.valueAsNumber : undefined)}
                  className="w-20 h-8 text-sm"
                />
              </div>
              <Slider
                value={field.value ? [field.value] : [0.1]}
                min={0.1}
                max={2.0}
                step={0.1}
                onValueChange={(values) => field.onChange(values[0])}
                className="w-full"
              />
              <FieldDescription>Wind force multiplier (0.1-2.0)</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="metadata.intensity"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <div className="flex items-center justify-between mb-2">
                <FieldLabel htmlFor="metadata-intensity">Intensity (Optional)</FieldLabel>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  id="metadata-intensity"
                  type="number"
                  step={0.1}
                  min={0.1}
                  max={2.0}
                  onChange={(e) => field.onChange(e.target.value ? e.target.valueAsNumber : undefined)}
                  className="w-20 h-8 text-sm"
                />
              </div>
              <Slider
                value={field.value ? [field.value] : [0.1]}
                min={0.1}
                max={2.0}
                step={0.1}
                onValueChange={(values) => field.onChange(values[0])}
                className="w-full"
              />
              <FieldDescription>Wind intensity multiplier (0.1-2.0)</FieldDescription>
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
              id="metadata-duration"
              min={1}
              max={60}
              step={1}
              defaultValue={15}
              description="How long the windstorm lasts (1-60 seconds)"
            />
          )}
        />
        <Controller
          name="metadata.radius"
          control={control}
          render={({ field, fieldState }) => (
            <NumberFieldWithSlider
              field={field}
              fieldState={fieldState}
              label="Radius"
              id="metadata-radius"
              min={5.0}
              max={50.0}
              step={0.1}
              defaultValue={20.0}
              description="Effect radius in blocks (5.0-50.0)"
            />
          )}
        />
        <Controller
          name="metadata.direction"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="metadata-direction">Direction (Optional)</FieldLabel>
              <Select value={field.value || undefined} onValueChange={field.onChange}>
                <SelectTrigger id="metadata-direction">
                  <SelectValue placeholder="Select direction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="north">North</SelectItem>
                  <SelectItem value="south">South</SelectItem>
                  <SelectItem value="east">East</SelectItem>
                  <SelectItem value="west">West</SelectItem>
                  <SelectItem value="northeast">Northeast</SelectItem>
                  <SelectItem value="northwest">Northwest</SelectItem>
                  <SelectItem value="southeast">Southeast</SelectItem>
                  <SelectItem value="southwest">Southwest</SelectItem>
                  <SelectItem value="random">Random</SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>Wind direction</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
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
              id="metadata-volume-windstorm"
              min={0.0}
              max={2.0}
              step={0.1}
              defaultValue={1.0}
              description="Sound volume (0.0-2.0)"
            />
          )}
        />
        <Controller
          name="metadata.effects"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="metadata-effects">Effects (Optional)</FieldLabel>
              <Select value={field.value || undefined} onValueChange={field.onChange}>
                <SelectTrigger id="metadata-effects">
                  <SelectValue placeholder="Select effect level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minimal">Minimal</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="maximum">Maximum</SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>Visual effect intensity</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="metadata.excludeFlying"
          control={control}
          render={({ field, fieldState }) => (
            <Field orientation="horizontal" data-invalid={fieldState.invalid} className="rounded-lg border p-4">
              <div>
                <FieldLabel htmlFor="metadata-excludeFlying">Exclude Flying Entities</FieldLabel>
                <FieldDescription>Don't affect flying entities</FieldDescription>
              </div>
              <Switch id="metadata-excludeFlying" checked={field.value ?? false} onCheckedChange={field.onChange} />
            </Field>
          )}
        />
        <Controller
          name="metadata.maxVelocity"
          control={control}
          render={({ field, fieldState }) => (
            <NumberFieldWithSlider
              field={field}
              fieldState={fieldState}
              label="Max Velocity"
              id="metadata-maxVelocity"
              min={0.5}
              max={5.0}
              step={0.1}
              defaultValue={2.0}
              description="Maximum velocity for pushed entities (0.5-5.0)"
            />
          )}
        />
        <Controller
          name="metadata.distanceFalloff"
          control={control}
          render={({ field, fieldState }) => (
            <Field orientation="horizontal" data-invalid={fieldState.invalid} className="rounded-lg border p-4">
              <div>
                <FieldLabel htmlFor="metadata-distanceFalloff">Distance Falloff</FieldLabel>
                <FieldDescription>Reduce effect strength with distance</FieldDescription>
              </div>
              <Switch id="metadata-distanceFalloff" checked={field.value ?? true} onCheckedChange={field.onChange} />
            </Field>
          )}
        />
      </FieldGroup>
    );
  }

  return null;
}

// Event Fields
function EventFields({ eventId, control }: { eventId: string; control: Control<any> }) {
  // Spawn Mobs event
  if (eventId === "random_mob_spawn") {
    return (
      <FieldGroup>
        <Controller
          name="metadata.amount"
          control={control}
          render={({ field, fieldState }) => (
            <NumberFieldWithSlider
              field={field}
              fieldState={fieldState}
              label="Amount"
              id="metadata-amount"
              min={1}
              max={1000}
              step={1}
              defaultValue={100}
              description="Number of mobs to spawn (1-1000)"
            />
          )}
        />
        <Controller
          name="metadata.mobList"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="metadata-mobList">Mob Types *</FieldLabel>
              <MobSelector
                value={Array.isArray(field.value) ? field.value : []}
                onChange={field.onChange}
              />
              <FieldDescription>Click to open the mob selector and choose which mobs to spawn</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="metadata.useViewerNames"
          control={control}
          render={({ field, fieldState }) => (
            <Field orientation="horizontal" data-invalid={fieldState.invalid} className="rounded-lg border p-4">
              <div>
                <FieldLabel htmlFor="metadata-useViewerNames">Use Viewer Names as Mob Names</FieldLabel>
                <FieldDescription>If enabled, will use the names of online viewers as mob names</FieldDescription>
              </div>
              <Switch
                id="metadata-useViewerNames"
                checked={!!field.value}
                onCheckedChange={field.onChange}
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>
    );
  }

  // Launch Player event
  if (eventId === "launce") {
    return (
      <FieldGroup>
        <Controller
          name="metadata.horizontalSpeed"
          control={control}
          render={({ field, fieldState }) => (
            <NumberFieldWithSlider
              field={field}
              fieldState={fieldState}
              label="Horizontal Speed"
              id="metadata-horizontalSpeed"
              min={1.0}
              max={20.0}
              step={0.1}
              defaultValue={10.2}
              description="Horizontal launch speed (1.0-20.0)"
            />
          )}
        />
        <Controller
          name="metadata.verticalSpeed"
          control={control}
          render={({ field, fieldState }) => (
            <NumberFieldWithSlider
              field={field}
              fieldState={fieldState}
              label="Vertical Speed"
              id="metadata-verticalSpeed"
              min={0.5}
              max={10.0}
              step={0.1}
              defaultValue={2.5}
              description="Vertical launch speed (0.5-10.0)"
            />
          )}
        />
        <Controller
          name="metadata.distance"
          control={control}
          render={({ field, fieldState }) => (
            <NumberFieldWithSlider
              field={field}
              fieldState={fieldState}
              label="Distance (blocks)"
              id="metadata-distance"
              min={50}
              max={2000}
              step={1}
              defaultValue={500}
              description="Teleport distance in blocks (50-2000)"
            />
          )}
        />
      </FieldGroup>
    );
  }

  // Twitch Subscription event
  if (eventId === "twitch_subscription") {
    return (
      <FieldGroup>
        <Controller
          name="metadata.subscriberName"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="metadata-subscriberName">Subscriber Name</FieldLabel>
              <Input {...field} value={field.value ?? "Someone"} id="metadata-subscriberName" maxLength={100} />
              <FieldDescription>Name of the subscriber (max 100 characters)</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="metadata.tier"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="metadata-tier">Tier</FieldLabel>
              <Select value={field.value ?? "1"} onValueChange={field.onChange}>
                <SelectTrigger id="metadata-tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Tier 1</SelectItem>
                  <SelectItem value="2">Tier 2</SelectItem>
                  <SelectItem value="3">Tier 3</SelectItem>
                  <SelectItem value="prime">Prime</SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>Subscription tier</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="metadata.customTitle"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="metadata-customTitle">Custom Title (Optional)</FieldLabel>
              <Input {...field} value={field.value ?? ""} id="metadata-customTitle" maxLength={100} />
              <FieldDescription>Custom title text (max 100 characters)</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="metadata.customSubtitle"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="metadata-customSubtitle">Custom Subtitle (Optional)</FieldLabel>
              <Input {...field} value={field.value ?? ""} id="metadata-customSubtitle" maxLength={100} />
              <FieldDescription>Custom subtitle text (max 100 characters)</FieldDescription>
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
              id="metadata-duration-subscription"
              min={1}
              max={10}
              step={1}
              defaultValue={5}
              description="How long the celebration lasts (1-10 seconds)"
            />
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
              max={15}
              step={1}
              defaultValue={3}
              description="Number of fireworks to launch (1-15)"
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
          name="metadata.customMessage"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="metadata-customMessage">Custom Message (Optional)</FieldLabel>
              <Textarea
                {...field}
                value={field.value ?? ""}
                id="metadata-customMessage"
                placeholder="Thank you for subscribing!"
                className="resize-none"
                rows={2}
                maxLength={500}
              />
              <FieldDescription>Custom message to display (max 500 characters)</FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="metadata.showChat"
          control={control}
          render={({ field, fieldState }) => (
            <Field orientation="horizontal" data-invalid={fieldState.invalid} className="rounded-lg border p-4">
              <div>
                <FieldLabel htmlFor="metadata-showChat">Show in Chat</FieldLabel>
                <FieldDescription>Display message in chat</FieldDescription>
              </div>
              <Switch id="metadata-showChat" checked={field.value ?? true} onCheckedChange={field.onChange} />
            </Field>
          )}
        />
        <Controller
          name="metadata.showTitle"
          control={control}
          render={({ field, fieldState }) => (
            <Field orientation="horizontal" data-invalid={fieldState.invalid} className="rounded-lg border p-4">
              <div>
                <FieldLabel htmlFor="metadata-showTitle">Show Title</FieldLabel>
                <FieldDescription>Display title on screen</FieldDescription>
              </div>
              <Switch id="metadata-showTitle" checked={field.value ?? true} onCheckedChange={field.onChange} />
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
          name="metadata.volume"
          control={control}
          render={({ field, fieldState }) => (
            <NumberFieldWithSlider
              field={field}
              fieldState={fieldState}
              label="Volume"
              id="metadata-volume-subscription"
              min={0.0}
              max={2.0}
              step={0.1}
              defaultValue={1.0}
              description="Sound volume (0.0-2.0)"
            />
          )}
        />
      </FieldGroup>
    );
  }

  return null;
}
