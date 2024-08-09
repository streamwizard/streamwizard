import SelectSenderID from "@/components/form-components/select-sender-id";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useEditor } from "@/hooks/UseWorkflowEditor";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";



const formSchema = z.object({
  chatter_id: z.string(),
  message: z.string().max(400).min(1, "Message is required"),
});

interface CustomMetaDataType {
  chatter_id?: string;
  message?: string;
}


export default function SendChatMessage() {
  "use no memo"
  const { state, dispatch } = useEditor();

  const metaData = state.editor.selectedNode!.data.metaData as CustomMetaDataType;
  


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      chatter_id: metaData.chatter_id ?? "",
      message: metaData.message ?? "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    dispatch({
      type: "UPDATE_METADATA",
      payload: {
        id: state.editor.selectedNode!.id,
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
