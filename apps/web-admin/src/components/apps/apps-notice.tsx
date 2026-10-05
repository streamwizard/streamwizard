import { Card, CardContent } from "@repo/ui";

const COPY = {
  "not-collected": {
    title: "No server data in this environment.",
    body: "Only production collects it. Open the production panel to see the apps.",
  },
  down: {
    title: "InfluxDB didn't answer, so there is nothing to show.",
    body: "The page tries again on the next refresh.",
  },
  empty: {
    title: "Nothing from the server yet.",
    body: "Telegraf on the Dokploy server writes here every 30 seconds.",
  },
} as const;

/** The card an /apps page shows instead of its content when there is no data to read. */
export function AppsNotice({ state }: { state: keyof typeof COPY }) {
  const { title, body } = COPY[state];
  return (
    <Card>
      <CardContent className="space-y-2 py-10 text-center text-sm text-muted-foreground">
        <p className="font-medium text-foreground">{title}</p>
        <p>{body}</p>
      </CardContent>
    </Card>
  );
}

/** Names the reads that failed, so blank columns are not mistaken for zeros. */
export function MissingData({ failed }: { failed: string[] }) {
  if (failed.length === 0) return null;
  return (
    <p className="text-sm text-amber-600 dark:text-amber-400" role="status">
      InfluxDB didn&apos;t answer for: {failed.join(", ")}. Those numbers are blank.
    </p>
  );
}
