function Avatar({ url }: { url: string | null }) {
  if (!url?.startsWith("https://")) return <span className="size-6 shrink-0 rounded-full bg-muted" aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element -- Twitch CDN avatar, same as the log page
  return <img src={url} alt="" className="size-6 shrink-0 rounded-full object-cover" />;
}

export function LiveUser({ name, avatarUrl }: { name: string | null; avatarUrl: string | null }) {
  return (
    <span className="flex items-center gap-2">
      <Avatar url={avatarUrl} />
      <span className="min-w-0 break-words">{name ?? "Unnamed"}</span>
    </span>
  );
}
