import { ChannelPointsTemplateForm } from "@/components/forms/channelpoints-template-form";
import { Button } from "@/components/ui/button";
import { IconArrowLeft } from "@tabler/icons-react";
import Link from "next/link";

export default function NewChannelPointPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/smp/admin/channel-points">
            <IconArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Create Channel Point Template</h1>
          <p className="text-muted-foreground mt-2">
            Configure a new channel points reward template
          </p>
        </div>
      </div>

      <ChannelPointsTemplateForm />
    </div>
  );
}
