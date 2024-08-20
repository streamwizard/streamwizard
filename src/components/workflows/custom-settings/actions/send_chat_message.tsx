import AutoCompleteTextArea from "@/components/AutoCompleteTextArea";
import SelectSenderID from "@/components/form-components/select-sender-id";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useEditor } from "@/hooks/UseWorkflowEditor";
import { getPlaceholderKeys } from "@/lib/placeholder-options";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

interface Placeholder {
  id: string;
  label: string;
  type: string;
  options: string[];
  uuid?: string;
}

const formSchema = z.object({
  chatter_id: z.string(),
  message: z.string().max(400).min(1, "Message is required"),
});

interface CustomMetaDataType {
  chatter_id?: string;
  message?: string;
}

export default function SendChatMessage() {
  "use no memo";
  const { state, dispatch } = useEditor();
  const [placeholders, setPlaceholders] = useState<Placeholder[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      chatter_id: "",
      message: "",
    },
  });

  useEffect(() => {
    form.reset({
      chatter_id: "",
      message: (state.editor.selectedNode?.data?.metaData as CustomMetaDataType)?.message || "",
    });
  }, [state.editor.selectedNode?.id]);

  useEffect(() => {
    const X: Placeholder[] = state.editor.parentNodes?.map((node) => {
      return {
        id: node.id,
        label: node.data.title as string,
        type: node.data.type as string,
        options: getPlaceholderKeys(node.data.type! as string),
      };
    }) || [];
    
    console.log(X);
    setPlaceholders(X);

  }, [state.editor.selectedNode]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values.message);
    dispatch({
      type: "UPDATE_METADATA",
      payload: {
        id: state.editor.selectedNode?.id!,
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
          console.error({ error });
        })}
        className="space-y-8 "
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
                <AutoCompleteTextArea placeholders={placeholders} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
}
