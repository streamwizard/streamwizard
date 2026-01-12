"use client";

import { Controller } from "react-hook-form";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { MetadataFieldsProps, NumberFieldWithSlider } from "../types";

export function WindstormFields({ eventId, control }: MetadataFieldsProps) {
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

