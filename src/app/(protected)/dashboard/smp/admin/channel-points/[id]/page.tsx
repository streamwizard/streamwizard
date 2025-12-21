import { getChannelPointsTemplateById } from "@/actions/smp";
import { ChannelPointsTemplateForm } from "@/components/forms/channelpoints-template-form";
import { Button } from "@/components/ui/button";
import { IconArrowLeft } from "@tabler/icons-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function EditChannelPointPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getChannelPointsTemplateById(id);

  if (!data || !Array.isArray(data) || data.length === 0) {
    notFound();
  }

  const channelPoint = data[0];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/smp/admin/channel-points">
            <IconArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Edit Channel Point Template</h1>
          <p className="text-muted-foreground mt-2">
            Update the "{channelPoint.title}" reward template
          </p>
        </div>
      </div>

      <ChannelPointsTemplateForm
        id={channelPoint.id}
        defaultValues={{
          title: channelPoint.title,
          cost: channelPoint.cost,
          background_color: channelPoint.background_color ?? "",
          prompt: channelPoint.prompt ?? "",
          is_enabled: channelPoint.is_enabled ?? true,
          is_user_input_required: channelPoint.is_user_input_required ?? false,
          is_global_cooldown_enabled: channelPoint.is_global_cooldown_enabled ?? false,
          global_cooldown_seconds: channelPoint.global_cooldown_seconds ?? 0,
          is_max_per_stream_enabled: channelPoint.is_max_per_stream_enabled ?? false,
          max_per_stream: channelPoint.max_per_stream ?? 1,
          is_max_per_user_per_stream_enabled:
            channelPoint.is_max_per_user_per_stream_enabled ?? false,
          max_per_user_per_stream: channelPoint.max_per_user_per_stream ?? 1,
          should_redemptions_skip_request_queue:
            channelPoint.should_redemptions_skip_request_queue ?? false,
          action: channelPoint.action ?? undefined,
        }}
      />
    </div>
  );
}
