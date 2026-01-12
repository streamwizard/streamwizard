"use client";

import { Controller } from "react-hook-form";
import { FieldGroup } from "@/components/ui/field";
import { MetadataFieldsProps, NumberFieldWithSlider } from "../types";

export function LaunchFields({ eventId, control }: MetadataFieldsProps) {
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


