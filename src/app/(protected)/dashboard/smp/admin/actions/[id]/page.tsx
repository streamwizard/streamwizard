import { getActionById } from "@/actions/smp";
import { ActionForm } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { IconArrowLeft } from "@tabler/icons-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function EditActionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getActionById(id);

  if (!data || !Array.isArray(data) || data.length === 0) {
    notFound();
  }

  const action = data[0];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/smp/admin/actions">
            <IconArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Edit Action</h1>
          <p className="text-muted-foreground mt-2">
            Update the "{action.name}" action
          </p>
        </div>
      </div>

      <ActionForm
        id={action.id}
        defaultValues={{
          name: action.name,
          action: action.action,
          description: action.description ?? "",
          metadata: action.metadata ?? null,
        }}
      />
    </div>
  );
}




