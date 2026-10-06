"use server";

import { supabaseAdmin } from "@repo/supabase/next/admin";
import { listUsers } from "@repo/supabase/queries/admin-users";
import { assertAdmin } from "@/lib/assert-admin";
import { userDisplayName } from "@/lib/users";

export interface PaletteUser {
  id: string;
  name: string;
  email: string;
}

const MAX_RESULTS = 6;

/** User lookup for the command palette: the same search the users page runs, cut to a handful. */
export async function searchUsersForPalette(query: string): Promise<PaletteUser[]> {
  await assertAdmin();

  const search = query.trim().slice(0, 100);
  if (search.length < 2) return [];

  const { users } = await listUsers(supabaseAdmin, { search }, 1, MAX_RESULTS);
  return users.map((user) => ({ id: user.id, name: userDisplayName(user), email: user.email }));
}
