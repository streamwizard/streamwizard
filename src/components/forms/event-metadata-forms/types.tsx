"use client";

import { Control } from "react-hook-form";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

// Common props for all metadata field components
export interface MetadataFieldsProps {
  eventId: string;
  control: Control<any>;
  triggerEventType?: string; // Optional: trigger event type for template variables
}

/**
 * Helper component for number fields with slider
 */
export function NumberFieldWithSlider({
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


