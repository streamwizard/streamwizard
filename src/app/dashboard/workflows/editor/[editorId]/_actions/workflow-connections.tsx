"use server";

import { auth } from "@/auth";
import { createClient } from "@/lib/supabase/server";
import { EditorNodeType, Trigger } from "@/types/workflow";

export const SaveWorkflow = async (flowId: string, nodes: EditorNodeType[], edges: string) => {
  const session = await auth();

  const supabase = createClient(session?.supabaseAccessToken as string);

  const action: string = JSON.stringify(nodes);

  const trigger = nodes.filter((node) => node.type === "Trigger").at(0)?.data;

  if (!trigger) return { error: "Trigger not found" };

  const { data, error } = await supabase.from("workflows").update({ nodes: action, edges }).match({ id: flowId });

  if (error) return error;

  // update the trigger event_id
  const { data: triggerData, error: triggerError } = await supabase
    .from("workflow_triggers")
    .update({ event_id: (trigger as Trigger).event_id, event_type: (trigger as Trigger).type })
    .match({ workflow: flowId });

  if (triggerError) {
    console.error(triggerError);
    return triggerError;
  }

  console.log(triggerData);

  return {
    message: "flow saved",
  };
};
