import { Button } from "@/components/ui/button";
import { IconArrowLeft } from "@tabler/icons-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <h2 className="text-2xl font-bold">Action Not Found</h2>
        <p className="text-muted-foreground">
          The action you're looking for doesn't exist.
        </p>
        <Button asChild>
          <Link href="/dashboard/smp/admin/actions">
            <IconArrowLeft className="mr-2 h-4 w-4" />
            Back to Actions
          </Link>
        </Button>
      </div>
    </div>
  );
}




