import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { WorkflowFormSchema } from "@/schemas/workflow-schema";
import { onCreateWorkflow, UpdateWorkflowDetails } from "@/actions/workflows";
import { WorkflowTable } from "@/types/database";
import { useModal } from "@/providers/modal-provider";

type Props = {
  title?: string;
  subTitle?: string;
  workflow?: WorkflowTable;
};

const Workflowform = ({ subTitle, title, workflow }: Props) => {
  "use no memo";
  const {closeModal} = useModal()


  const form = useForm<z.infer<typeof WorkflowFormSchema>>({
    mode: "onChange",
    resolver: zodResolver(WorkflowFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const isLoading = form.formState.isLoading;
  const router = useRouter();

  const handleSubmit = async (values: z.infer<typeof WorkflowFormSchema>) => {
    if (workflow) {
      toast.promise(UpdateWorkflowDetails({ workflow_id: workflow.id, name: values.name, description: values.description }), {
        loading: "Updating Details",
        success: "Workflow Detials has been updated",
        error: "Failed to update workflow details",
      });
    } else {
      toast.promise(onCreateWorkflow(values.name, values.description), {
        loading: "Creating workflow...",
        success: `Workflow ${values.name} has been created`,
        error: `Failed to create workflow`
      })
    }
    closeModal()
  };

  useEffect(() => {
    if (workflow) {
      form.setValue("name", workflow.name);
      form.setValue("description", workflow.description);
    }

    return () => {
      form.setValue("name", "");
      form.setValue("description", "");
    };
  }, [workflow]);

  return (
    <Card className="w-full border-none">
      {title && subTitle && (
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{subTitle}</CardDescription>
        </CardHeader>
      )}
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4 text-left">
            <FormField
              disabled={isLoading}
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              disabled={isLoading}
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="Description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button className="mt-4" disabled={isLoading} type="submit">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving
                </>
              ) : (
                "Save Settings"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default Workflowform;
