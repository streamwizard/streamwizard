"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Form } from "@repo/ui/components/ui/form";
import { updateSmpMinecraftName } from "@/actions/smp/waitlist";
import { MinecraftNameField } from "@/components/public/smp/minecraft-name-field";
import { minecraftNameSchema, type MinecraftNameInput } from "@/schemas/smp";

/* Changing the Minecraft name after sign-up. The server looks the new name up and stores its UUID with it. */
export function SmpNameEditForm({ currentName, onDone }: { currentName: string; onDone: () => void }) {
  const form = useForm<MinecraftNameInput>({
    resolver: zodResolver(minecraftNameSchema),
    defaultValues: { minecraftUsername: currentName },
  });
  const { isSubmitting, errors } = form.formState;

  async function onSubmit(values: MinecraftNameInput) {
    const result = await updateSmpMinecraftName(values);
    if (result.success) {
      toast.success("Name updated.");
      onDone();
      return;
    }
    form.setError(result.field ?? "root", { message: result.error });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <MinecraftNameField />
        {errors.root?.message && (
          <p role="alert" className="text-sm text-destructive">
            {errors.root.message}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={isSubmitting} className="pixel-btn pixel-btn-primary">
            {isSubmitting ? "Looking it up…" : "Save name"}
          </button>
          <button type="button" onClick={onDone} disabled={isSubmitting} className="pixel-btn">
            Cancel
          </button>
        </div>
      </form>
    </Form>
  );
}
