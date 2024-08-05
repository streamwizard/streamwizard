import React, { use, useEffect } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox"; // Assuming you have a Checkbox component
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import SelectChannelpoint from "@/components/form-components/select-channelpoint";
import { useEditor } from "@/hooks/UseWorkflowEditor";
import SelectSenderID from "@/components/form-components/select-sender-id";

interface ICustomRewardUpdateProps {}

const formSchema = z.object({
  chatter_id: z.string(),
  message: z.string().max(400),
});

export default function SendChatMessage() {
  const { state, dispatch } = useEditor();

  useEffect(() => {
    // set initial values
    if (state.editor.selectedNode.data.metaData) {
      const { message, chatter_id } = state.editor.selectedNode.data.metaData;
      if (chatter_id) form.setValue("chatter_id", chatter_id);
      if (message) form.setValue("message", message);

      console.log({ message, chatter_id });
    }
  }, [state.editor.selectedNode]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      chatter_id: "956066753",
      message: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    dispatch({
      type: "UPDATE_METADATA",
      payload: {
        id: state.editor.selectedNode.id,
        metadata: {
          chatter_id: values.chatter_id,
          message: values.message,
        },
      },
    });
  }

  return (
    <Form {...form}>
      <form
        onChange={form.handleSubmit(onSubmit, (error) => {
          console.log({ error });
        })}
        className="space-y-8 overflow-scroll"
      >
        <FormField
          control={form.control}
          name="chatter_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Who is sending the message?</FormLabel>
              <FormControl>
                <SelectSenderID value={form.watch("chatter_id")} onValueChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Message</FormLabel>
              <FormControl>
                <Input  {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
