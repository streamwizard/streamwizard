export function TwitchLink({ username }: { username: string }) {
  return (
    <a
      href={`https://twitch.tv/${encodeURIComponent(username)}`}
      target="_blank"
      rel="noreferrer"
      // Above the row's own link, so this one still opens Twitch.
      className="relative z-10 font-medium underline-offset-4 hover:underline"
    >
      {username}
    </a>
  );
}
