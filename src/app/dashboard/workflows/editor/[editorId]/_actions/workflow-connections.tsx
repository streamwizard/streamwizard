"use server";

import { auth } from "@/auth";
import { createClient } from "@/lib/supabase/server";

export const onCreateNodesEdges = async (flowId: string, nodes: string, edges: string, flowpath: string) => {
  const session = await auth();

  const supabase = createClient(session?.supabaseAccessToken as string);

  const { data, error } = await supabase.from("workflows").update({ nodes, edges, flowpath }).match({ id: flowId });

  if (error) return error;

  return {
    message: "flow saved",
  };
};
