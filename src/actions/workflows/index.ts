"use server";

import { auth } from "@/auth";
import { createClient } from "@/lib/supabase/server";

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
    const workflow = await supabase.from("workflows").insert({ user_id: session?.user.id, name, description });

    if (workflow.error) {
      console.log(workflow.error);
      return { message: "Oops! try again" };
    }

    return { message: "Workflow created" };
  }
};