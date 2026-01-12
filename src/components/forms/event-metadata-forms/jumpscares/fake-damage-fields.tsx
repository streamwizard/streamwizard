"use client";

import { Controller } from "react-hook-form";
import { FieldGroup } from "@/components/ui/field";
import { MetadataFieldsProps, NumberFieldWithSlider } from "../types";

export function FakeDamageFields({ eventId, control }: MetadataFieldsProps) {
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


