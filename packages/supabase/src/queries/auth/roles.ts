import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/supabase";

type DBClient = SupabaseClient<Database>;

/** Platform roles (`user_roles`). Every admin check and role change goes through here. */

export const ADMIN_ROLE = "admin";

export async function isUserAdmin(client: DBClient, userId: string): Promise<boolean> {
  const { data } = await client
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", ADMIN_ROLE)
    .maybeSingle();
  return !!data;
}

/** The id of the user's admin role row, or null when they aren't an admin. Throws on a read error. */
export async function getAdminRoleId(client: DBClient, userId: string): Promise<string | null> {
  const { data, error } = await client
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", ADMIN_ROLE)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

/** Gives the user the admin role and returns the new row's id. */
export async function grantAdminRole(client: DBClient, userId: string): Promise<string> {
  const { data, error } = await client
    .from("user_roles")
    .insert({ user_id: userId, role: ADMIN_ROLE })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function deleteUserRole(client: DBClient, roleId: string): Promise<void> {
  const { error } = await client.from("user_roles").delete().eq("id", roleId);
  if (error) throw error;
}
