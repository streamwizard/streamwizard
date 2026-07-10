"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { createClipFolder, editClipFolder } from "@/actions/supabase/clips/clips";
import { Button } from "@repo/ui";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@repo/ui";
import { Input } from "@repo/ui";
import { useModal } from "@/providers/modal-provider";
import { toast } from "sonner";

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
  folder_id?: string;
  folder_name?: string;
  parent_folder_id?: string;
  parent_folder_name?: string;
}

export function ClipFolderModal({ user_id, folder_id, folder_name, parent_folder_id, parent_folder_name }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { closeModal } = useModal();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: folder_name || "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    if (folder_id) {
      toast.promise(
        async () => {
          const res = await editClipFolder(folder_id, values.name, user_id);
          if (!res.success) {
            throw new Error(res.message);
          }
          return res.message;
        },
        {
          loading: "Updating folder...",
          success: "Folder updated successfully!",
          error: "Failed to update folder.",
          finally() {
            setIsSubmitting(false);
            closeModal();
          },
        }
      );
    } else {
      toast.promise(
        async () => {
          const res = await createClipFolder(values.name, user_id, parent_folder_id);
          if (!res.success) {
            throw new Error(res.message);
          }
          return res.message;
        },
        {
          loading: "Creating folder...",
          success: "Folder created successfully!",
          error: (error) => (error instanceof Error ? error.message : "Failed to create folder."),
          finally() {
            setIsSubmitting(false);
            closeModal();
          },
        }
      );
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 w-full sm:w-[480px]">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{folder_id ? "Folder Name" : parent_folder_name ? "Subfolder Name" : "Folder Name"}</FormLabel>
              <FormControl>
                <Input placeholder={parent_folder_name ? `Inside ${parent_folder_name}` : "My New Folder"} {...field} />
              </FormControl>
              <FormDescription>
                {folder_id
                  ? "Enter a new name for this folder."
                  : parent_folder_name
                    ? `This subfolder will be created inside "${parent_folder_name}".`
                    : "Enter a name for your new folder."}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {folder_id ? "Updating..." : "Creating..."}
            </>
          ) : (
            <>{folder_id ? "Rename Folder" : parent_folder_name ? "Create Subfolder" : "Create Folder"}</>
          )}
        </Button>
      </form>
    </Form>
  );
}
