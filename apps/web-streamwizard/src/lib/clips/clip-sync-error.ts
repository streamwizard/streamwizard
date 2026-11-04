// What to tell someone when a clip sync fails, from how the sync API answered.
//
// It used to be "Error syncing clips" for everything, which says neither what
// broke nor what to do. The cases really are different: the API being down is
// ours to fix and worth a retry, a missing or expired Twitch connection is
// theirs to fix and no retry will help.
export function clipSyncErrorMessage(status: number | undefined): string {
  // No status at all: the request never got an answer.
  if (status === undefined) return "Couldn't reach the clip sync. Give it a minute and try again.";
  if (status === 401) return "Your session ran out. Reload the page and try again.";
  // The API could not find a usable Twitch connection for this account.
  if (status === 400 || status === 404) return "Couldn't load your clips. Check your Twitch connection.";
  if (status === 429) return "Too many syncs in a row. Give it a minute.";
  return "Something broke on our end. Try again?";
}
