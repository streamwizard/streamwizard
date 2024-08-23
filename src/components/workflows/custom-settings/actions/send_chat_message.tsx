import Editor from "@/components/AutoCompleteTextArea";
import SelectSenderID from "@/components/form-components/select-sender-id";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useEditor } from "@/hooks/UseWorkflowEditor";
import { SendChatMessageMetaData, SendChatMessageSchema } from "@/schemas/workflow-node-settings";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

export default function SendChatMessage() { 
  const { state, dispatch } = useEditor();
  const { sender_id, message } = state.editor.selectedNode?.data.metaData as SendChatMessageMetaData;


  const form = useForm<z.infer<typeof SendChatMessageSchema>>({
    resolver: zodResolver(SendChatMessageSchema),
    defaultValues: {
      sender_id: sender_id || "",
      message: message || "+100",
    },
  });

  function onSubmit(values: z.infer<typeof SendChatMessageSchema>) {
    if (!state.editor.selectedNode) return;

    console.log(values.message);

    dispatch({
      type: "UPDATE_METADATA",
      payload: {
        id: state.editor.selectedNode.id,
        metadata: values as SendChatMessageMetaData,
      },
    });
  }

  return (
    <Form {...form}>
      <form
        onChange={(e) => {
          e.preventDefault();
          form.handleSubmit(onSubmit)();
        }}
        className="space-y-8 "
      >
        <FormField
          control={form.control}
          name="sender_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sender</FormLabel>
              <FormControl>
                <>
                  <SelectSenderID value={form.watch("sender_id")!} onValueChange={field.onChange} />
                </>
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
              <FormLabel>Update Reward Cost</FormLabel>
              <FormControl>
                <Editor
                  triggerChar="@"
                  initialValue={message}
                  onChange={(value) => {
                    field.onChange(value);
                    form.handleSubmit(onSubmit)(); // Trigger the form submission on every change
                  }}
                />
              </FormControl>
              <FormDescription>Use &quot;+&quot; to increase and &quot;-&quot; to decrease</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
