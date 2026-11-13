"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui/components/ui/form";
import { Input } from "@repo/ui/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";
import { joinSmpWaitlist } from "@/actions/smp/waitlist";
import { MinecraftNameField } from "@/components/public/smp/minecraft-name-field";
import {
  SMP_STREAM_FREQUENCIES,
  SMP_STREAM_LANGUAGES,
  smpWaitlistSchema,
  type SmpStreamLanguage,
  type SmpWaitlistInput,
} from "@/schemas/smp";

// NativeSelect wraps its <select> in a fit-content box; in this form the selects fill their column.
const SELECT_ITEM = "content-start [&_[data-slot=native-select-wrapper]]:w-full";

/*
 * Step four. The Twitch channel is the signed-in account's, so the form does
 * not ask for it; broadcaster type and follower count are read from Twitch on
 * the server when this is submitted. `streamLanguage` starts on the channel's
 * own language when Twitch told us one.
 *
 * The action revalidates /smp, so a successful submit swaps this form for the
 * done state without a reload.
 */
export function SmpWaitlistForm({ streamLanguage }: { streamLanguage: SmpStreamLanguage | null }) {
  const form = useForm<SmpWaitlistInput>({
    resolver: zodResolver(smpWaitlistSchema),
    defaultValues: { minecraftUsername: "", streamLanguage: streamLanguage ?? undefined },
  });
  const { isSubmitting, errors } = form.formState;

  async function onSubmit(values: SmpWaitlistInput) {
    const result = await joinSmpWaitlist(values);
    if (result.success) {
      toast.success("You're on the waitlist.");
      return;
    }
    form.setError(result.field ?? "root", { message: result.error });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <MinecraftNameField />
        </div>

        <FormField
          control={form.control}
          name="averageViewers"
          render={({ field }) => (
            <FormItem className="content-start">
              <FormLabel>Average viewers</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  className="rounded-none"
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  value={field.value ?? ""}
                  // An empty box is "not answered", not zero: valueAsNumber gives NaN, which the schema turns down.
                  onChange={(event) => field.onChange(event.target.valueAsNumber)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="streamLanguage"
          render={({ field }) => (
            <FormItem className={SELECT_ITEM}>
              <FormLabel>Stream language</FormLabel>
              <FormControl>
                <NativeSelect {...field} value={field.value ?? ""} className="w-full rounded-none">
                  <NativeSelectOption value="" disabled>
                    Pick a language
                  </NativeSelectOption>
                  {Object.entries(SMP_STREAM_LANGUAGES).map(([code, label]) => (
                    <NativeSelectOption key={code} value={code}>
                      {label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="streamFrequency"
          render={({ field }) => (
            <FormItem className={`${SELECT_ITEM} sm:col-span-2`}>
              <FormLabel>How often you stream</FormLabel>
              <FormControl>
                <NativeSelect {...field} value={field.value ?? ""} className="w-full rounded-none">
                  <NativeSelectOption value="" disabled>
                    Pick one
                  </NativeSelectOption>
                  {Object.entries(SMP_STREAM_FREQUENCIES).map(([value, label]) => (
                    <NativeSelectOption key={value} value={value}>
                      {label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex flex-col gap-3 sm:col-span-2">
          {errors.root?.message && (
            <p role="alert" className="text-sm text-destructive">
              {errors.root.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Your Twitch channel comes from your account. We read its broadcaster type and follower count from Twitch
            when you submit.
          </p>
          <button type="submit" disabled={isSubmitting} className="pixel-btn pixel-btn-primary sm:self-start">
            {isSubmitting ? "Looking up your account…" : "Join the waitlist"}
          </button>
        </div>
      </form>
    </Form>
  );
}
