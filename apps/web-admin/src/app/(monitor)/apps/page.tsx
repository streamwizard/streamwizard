import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui";
import { AppTable } from "@/components/apps/app-table";
import { AppsNotice, MissingData } from "@/components/apps/apps-notice";
import { OtherApps } from "@/components/apps/other-apps";
import { ServerCard } from "@/components/apps/server-card";
import { AutoRefresh } from "@/components/vms/auto-refresh";
import { PageHeader } from "@/components/widgets/page-header";
import { getAppsOverview } from "@/lib/apps";
import { ENV_LABEL, OUR_ENVS, rowsOf } from "@/lib/apps-model";

export const dynamic = "force-dynamic";

const header = <PageHeader title="Apps" description="Every app on the Dokploy server: load, restarts, health and requests. Live from Telegraf, every 30 seconds." />;

export default async function AppsPage() {
  const overview = await getAppsOverview();

  if (overview.state !== "ok") {
    return (
      <div className="space-y-6">
        {overview.state !== "not-collected" && <AutoRefresh />}
        {header}
        <AppsNotice state={overview.state} />
      </div>
    );
  }
  const { server, rows, failed } = overview;

  return (
    <div className="space-y-6">
      <AutoRefresh />
      {header}
      <MissingData failed={failed} />

      {server && <ServerCard server={server} />}

      {OUR_ENVS.map((env) => (
        <Card key={env}>
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-base">{ENV_LABEL[env]}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <AppTable rows={rowsOf(rows, env)} />
          </CardContent>
        </Card>
      ))}

      <OtherApps rows={rowsOf(rows, "other")} />
    </div>
  );
}
