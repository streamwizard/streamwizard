"use client";

import { Controller } from "react-hook-form";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { MetadataFieldsProps, NumberFieldWithSlider } from "../types";

export function SupernovaFields({ eventId, control }: MetadataFieldsProps) {
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

