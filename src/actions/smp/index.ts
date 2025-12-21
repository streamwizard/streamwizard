"use server";

import { createClient } from "@/lib/supabase/server";
import { Database } from "@/types/supabase";


// create a new channel points template
export async function createChannelPointsTemplate(formData: Database["public"]["Tables"]["smp_channelpoints_templates"]["Insert"]) {
  const supabase = await createClient();
  const { error } = await supabase.from("smp_channelpoints_templates").insert(formData);
  if (error) {
    console.error(error);
    return false;
  }
  return true;
}

// update a channel points template
export async function updateChannelPointsTemplate(id: string, formData: Database["public"]["Tables"]["smp_channelpoints_templates"]["Insert"]) {
  const supabase = await createClient();
  const { error } = await supabase.from("smp_channelpoints_templates").update(formData).eq("id", id);
  if (error) {
    console.error(error);
    return false;
  }
  return true;
}

// get all channel points templates
export async function getAllChannelPointsTemplates() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("smp_channelpoints_templates").select("*");
  if (error) {
    console.error(error);
    return false;
  }
  return data;
}

// get a channel points template by id
export async function getChannelPointsTemplateById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("smp_channelpoints_templates").select("*").eq("id", id);
  if (error) {
    console.error(error);
    return false;
  }
  return data;
}

// ============== ACTIONS ==============

// create a new action
export async function createAction(formData: Database["public"]["Tables"]["smp_actions"]["Insert"]) {
  const supabase = await createClient();
  const { error } = await supabase.from("smp_actions").insert(formData);
  if (error) {
    console.error(error);
    return false;
  }
  return true;
}

// update an action
export async function updateAction(id: string, formData: Database["public"]["Tables"]["smp_actions"]["Insert"]) {
  const supabase = await createClient();
  const { error } = await supabase.from("smp_actions").update(formData).eq("id", id);
  if (error) {
    console.error(error);
    return false;
  }
  return true;
}

// get all actions
export async function getAllActions() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("smp_actions").select("*");
  if (error) {
    console.error(error);
    return false;
  }
  return data;
}

// get an action by id
export async function getActionById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("smp_actions").select("*").eq("id", id);
  if (error) {
    console.error(error);
    return false;
  }
  return data;
}