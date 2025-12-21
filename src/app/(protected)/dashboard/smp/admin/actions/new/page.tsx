import { ActionForm } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { IconArrowLeft } from "@tabler/icons-react";
import Link from "next/link";

export default function NewActionPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/smp/admin/actions">
            <IconArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Create Action</h1>
          <p className="text-muted-foreground mt-2">
            Configure a new action for channel points
          </p>
        </div>
      </div>

      <ActionForm />
    </div>
  );
}




