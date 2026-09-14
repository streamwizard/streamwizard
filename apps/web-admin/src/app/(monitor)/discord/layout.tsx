import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { getDiscordContext } from "@/lib/discord/api";

export default function DiscordLayout({ children }: { children: React.ReactNode }) {
  if (getDiscordContext()) return children;

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-base">Discord isn&apos;t set up here</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>
          Add <code className="font-mono text-xs">DISCORD_BOT_TOKEN</code> and{" "}
          <code className="font-mono text-xs">DISCORD_GUILD_ID</code> to this app&apos;s Doppler config, then redeploy.
        </p>
        <p>
          For instant cache refreshes and the panel and test buttons, also set{" "}
          <code className="font-mono text-xs">DISCORD_BOT_INTERNAL_URL</code> and{" "}
          <code className="font-mono text-xs">DISCORD_BOT_INTERNAL_SECRET</code>.
        </p>
      </CardContent>
    </Card>
  );
}
