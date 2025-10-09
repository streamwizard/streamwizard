"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Input } from "@/components/ui/input"
import ResponseMentionsTextarea from "@/components/commands/response-mentions-textarea"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { commandSchema, type CommandFormValues } from "@/schemas/command"

type Props = {
  action: (formData: FormData) => Promise<void>
  defaultValues?: Partial<CommandFormValues>
  submitLabel?: string
}

export function CommandForm({ action, defaultValues, submitLabel = "Save" }: Props) {
  const form = useForm<CommandFormValues>({
    resolver: zodResolver(commandSchema),
    mode: "onChange",
    defaultValues: {
      trigger: defaultValues?.trigger ?? "",
      response: defaultValues?.response ?? "",
      permission: (defaultValues?.permission as any) ?? "everyone",
      cooldown_seconds: defaultValues?.cooldown_seconds ?? 0,
      shared: Boolean(defaultValues?.shared) ?? false,
    },
  })

  const watchedPermission = form.watch("permission")
  const watchedShared = form.watch("shared")

  return (
    <Form {...form}>
      <form action={action} className="space-y-4">
        {/* Hidden inputs ensure values for non-native controls are sent to the server action */}
        <input type="hidden" name="permission" value={watchedPermission} />
        {watchedShared && <input type="hidden" name="shared" value="true" />}

        <FormField
          control={form.control}
          name="trigger"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Trigger</FormLabel>
              <FormControl>
                <Input placeholder="e.g. uptime" {...field} onChange={(e) => field.onChange(e.target.value.replace(/^!/, ""))} />
              </FormControl>
              <p className="text-xs text-muted-foreground">Do not include the exclamation mark. Example: &quot;uptime&quot; becomes &quot;!uptime&quot;.</p>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="response"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Response</FormLabel>
              <FormControl>
                <ResponseMentionsTextarea placeholder={"Thanks for the follow, {user}! This command was used {count} times."} {...field} />
              </FormControl>
              <p className="text-xs text-muted-foreground">Variables: {"{user}"}, {"{count}"}</p>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="permission"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Permission</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Select permission" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="everyone">Everyone</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="broadcaster">Broadcaster</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="cooldown_seconds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cooldown (seconds)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  value={field.value ?? 0}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="shared"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(Boolean(v))} />
                  <span>Share this command</span>
                </label>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={!form.formState.isValid || form.formState.isSubmitting}>{submitLabel}</Button>
      </form>
    </Form>
  )
}

export default CommandForm


