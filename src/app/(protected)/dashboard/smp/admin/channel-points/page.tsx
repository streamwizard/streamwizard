import { getAllChannelPointsTemplates } from "@/actions/smp";
import { ChannelPointsTable } from "@/components/tables/channelpoints-table";
import { Button } from "@/components/ui/button";
import { IconPlus } from "@tabler/icons-react";
import Link from "next/link";

export default async function ChannelPointsPage() {
  const channelPoints = await getAllChannelPointsTemplates();

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Channel Points Templates</h1>
          <p className="text-muted-foreground mt-2">
            Manage your Twitch channel points reward templates
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/smp/admin/channel-points/new">
            <IconPlus className="mr-2 h-4 w-4" />
            Create New
          </Link>
        </Button>
      </div>

      {channelPoints && Array.isArray(channelPoints) ? (
        <ChannelPointsTable data={channelPoints} />
      ) : (
        <div className="rounded-lg border p-8 text-center">
          <p className="text-muted-foreground">Failed to load channel points templates</p>
        </div>
      )}
    </div>
  );
}
