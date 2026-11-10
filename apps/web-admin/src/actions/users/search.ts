"use server";

import { z } from "zod";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { listUsers } from "@repo/supabase/queries/users/admin-users";
import { toDataError, type DataResult } from "@/lib/actions/action-error";
import { requireAdmin } from "@/lib/auth/admin-context";
import { userDisplayName } from "@/lib/users/users";
import type { PaletteUser } from "@/types/users";

const MAX_RESULTS = 6;

// Longer input is cut, not refused: the palette sends whatever was typed.
const querySchema = z
  .string()
  .max(1000)
  .transform((query) => query.trim().slice(0, 100));

/** User lookup for the command palette: the same search the users page runs, cut to a handful. */
export async function searchUsersForPalette(query: string): Promise<DataResult<PaletteUser[]>> {
  try {
    await requireAdmin();
    const search = querySchema.safeParse(query);
    if (!search.success) return { data: [], error: null };
    if (search.data.length < 2) return { data: [], error: null };

    const { users } = await listUsers(supabaseAdmin, { search: search.data }, 1, MAX_RESULTS);
    return { data: users.map((user) => ({ id: user.id, name: userDisplayName(user), email: user.email })), error: null };
  } catch (error) {
    return toDataError(error, "users.palette-search", "Couldn't search users. Try again?");
  }
}
