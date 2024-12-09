"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { createClipFolder } from "@/actions/supabase/clips/clips";
import { useSession } from "@/providers/session-provider";
import { useModal } from "@/providers/modal-provider";

const formSchema = z.object({
  name: z
    .string()
    .min(1, {
      message: "Folder name must be at least 1 character.",
    })
    .max(255, {
      message: "Folder name must not exceed 255 characters.",
    })
    .regex(/^[a-zA-Z0-9-_\s]+$/, {
      message: "Folder name can only contain letters, numbers, spaces, hyphens, and underscores.",
    }),
});

interface Props {
  user_id: string;
}

export function CLipFolderModal({ user_id }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { closeModal } = useModal();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    toast.promise(createClipFolder(values.name, user_id), {
      loading: "Creating folder...",
      success: "Folder created successfully!",
      error: "Failed to create folder.",
      finally() {
        setIsSubmitting(false);
        closeModal();
      },
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Folder Name</FormLabel>
              <FormControl>
                <Input placeholder="My New Folder" {...field} />
              </FormControl>
              <FormDescription>Enter a name for your new folder.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            "Create Folder"
          )}
        </Button>
      </form>
    </Form>
  );
}
