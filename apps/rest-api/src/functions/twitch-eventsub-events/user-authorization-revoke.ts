import { supabase } from "@repo/supabase";
import type { UserAuthorizationRevokeEvent } from "@repo/schemas";

export const handleUserAuthorizationRevoke = async (event: UserAuthorizationRevokeEvent) => {
  const { data: userId, error } = await supabase.rpc("delete_user_data", {
    p_twitch_user_id: event.user_id,
  });

  if (error) throw error;

  // User not found — already deleted or never registered
  if (!userId) return;

  // deleteUser removes the account and invalidates all active sessions
  const { error: authError } = await supabase.auth.admin.deleteUser(userId);

  if (authError) throw authError;
};
