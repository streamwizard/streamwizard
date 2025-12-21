import { getAllActions } from "@/actions/smp";
import { ActionsTable } from "@/components/tables/actions-table";
import { Button } from "@/components/ui/button";
import { IconPlus } from "@tabler/icons-react";
import Link from "next/link";

export default async function ActionsPage() {
  const actions = await getAllActions();

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Actions</h1>
          <p className="text-muted-foreground mt-2">
            Manage actions that can be triggered by channel points
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/smp/admin/actions/new">
            <IconPlus className="mr-2 h-4 w-4" />
            Create New
          </Link>
        </Button>
      </div>

      {actions && Array.isArray(actions) ? (
        <ActionsTable data={actions} />
      ) : (
        <div className="rounded-lg border p-8 text-center">
          <p className="text-muted-foreground">Failed to load actions</p>
        </div>
      )}
    </div>
  );
}
