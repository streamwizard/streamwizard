"use server";

import { auth } from "@/auth";
import { createClient } from "@/lib/supabase/server";
import { Trigger } from "@/types/workflow";
import { Node } from "@xyflow/react";

// get all workflows
export const onGetWorkflows = async () => {
  const session = await auth();

  const supabase = createClient(session?.supabaseAccessToken as string);
  const { data, error } = await supabase.from("workflows").select("*");

  if (error) {
    throw error.message;
  }

  if (data) return data;
};

// get workflow by id
export const getWorkflowByID = async (workflowId: string) => {
  const session = await auth();
  const supabase = createClient(session?.supabaseAccessToken as string);

  const { data, error } = await supabase.from("workflows").select("nodes, edges").match({ id: workflowId }).single();

  if (error) {
    throw error.message;
  }

  if (data) {
    return data;
  }
};

export const onFlowPublish = async (workflowId: string, state: boolean) => {
  const session = await auth();

  const supabase = createClient(session?.supabaseAccessToken as string);

  const { data, error } = await supabase.from("workflows").update({ publish: state }).match({ id: workflowId });

  if (error) return error.message;

  if (state) return "Workflow published";
  return "Workflow unpublished";
};

export const onCreateNodeTemplate = async (content: string, type: string, workflowId: string) => {
  const session = await auth();

  const supabase = createClient(session?.supabaseAccessToken as string);
  if (type === "Discord") {
    const { data, error } = await supabase.from("workflows").update({ discordtemplate: content }).match({ id: workflowId });

    if (error) {
      return error.message;
    }

    if (data) {
      return "Discord template saved";
    }
  }
};

export const onCreateWorkflow = async (name: string, description: string) => {
  const session = await auth();

  const supabase = createClient(session?.supabaseAccessToken as string);

  if (session) {
    //create new workflow
    const workflow = await supabase.from("workflows").insert({ user_id: session?.user.id, name, description }).select("*").single();

    if (workflow.error || !workflow.data) {
      console.error(workflow.error);
      return { message: "Oops! try again" };
    }

    return { message: "Workflow created", id: workflow.data?.id };
  }
};

export const SaveWorkflow = async (flowId: string, nodes: string, edges: string) => {
  const session = await auth();

  const supabase = createClient(session?.supabaseAccessToken as string);

  const trigger = JSON.parse(nodes)
    .filter((node: Node) => node.type === "Trigger")
    .at(0)?.data;

  if (!trigger) return { error: "Trigger not found" };

  const { data, error } = await supabase.from("workflows").update({ nodes, edges }).match({ id: flowId });

  if (error) return error;

  const event_id = (trigger as Trigger).metaData?.event_id;

  // update the trigger event_id
  const { data: triggerData, error: triggerError } = await supabase
    .from("workflow_triggers")
    .update({ event_id, event_type: (trigger as Trigger).type })
    .match({ workflow: flowId });

  if (triggerError) {
    console.error(triggerError);
    return triggerError;
  }

  return {
    message: "flow saved",
  };
};

// delete workflow
export const DeleteWorkflow = async (workflow_id: string) => {
  const session = await auth();

  const supabase = createClient(session?.supabaseAccessToken as string);

  const { error } = await supabase.from("workflows").delete().eq("id", workflow_id);

  if (error) {
    return {
      message: "Failed to remove workflow",
    };
  }

  return {
    message: "Workflow deleted",
  };
};
