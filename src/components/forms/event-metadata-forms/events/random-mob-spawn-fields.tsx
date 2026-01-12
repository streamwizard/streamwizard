"use client";

import { Controller } from "react-hook-form";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { MobSelector } from "../../mob-selector";
import { MetadataFieldsProps, NumberFieldWithSlider } from "../types";

export function RandomMobSpawnFields({ eventId, control }: MetadataFieldsProps) {
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


