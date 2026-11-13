"use client";

import { useFormContext } from "react-hook-form";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/ui/form";
import { Input } from "@repo/ui/components/ui/input";
import type { MinecraftNameInput } from "@/schemas/smp";

/*
 * The Minecraft name input, shared by the sign-up form and the edit form.
 * Reads the form from context, so it works in any form whose values include
 * `minecraftUsername`.
 */
export function MinecraftNameField() {
  const { control } = useFormContext<MinecraftNameInput>();

  return (
    <FormField
      control={control}
      name="minecraftUsername"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Minecraft Java name</FormLabel>
          <FormControl>
            <Input
              {...field}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={16}
              placeholder="Steve"
              className="rounded-none"
            />
          </FormControl>
          <FormDescription>3 to 16 letters, numbers or underscores. We look it up with Mojang.</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
