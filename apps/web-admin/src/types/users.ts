/** What the ban, unban and delete actions on /users/[id] answer. */
export interface ModerationResult {
  error: string | null;
  /** Side steps that failed without stopping the main one. */
  warnings: string[];
}

/** One user hit in the command palette. */
export interface PaletteUser {
  id: string;
  name: string;
  email: string;
}
