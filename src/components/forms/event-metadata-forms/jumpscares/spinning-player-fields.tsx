"use client";

import { Controller } from "react-hook-form";
import { FieldGroup } from "@/components/ui/field";
import { MetadataFieldsProps, NumberFieldWithSlider } from "../types";

export function SpinningPlayerFields({ eventId, control }: MetadataFieldsProps) {
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


