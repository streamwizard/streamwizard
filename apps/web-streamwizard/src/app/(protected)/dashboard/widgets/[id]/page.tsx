import { getWidget } from "@/actions/widgets";
import { notFound } from "next/navigation";
import { WidgetEditorClient } from "./widget-editor-client";

export default async function WidgetEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data: widget, error } = await getWidget(id);

  if (error || !widget) notFound();

  return <WidgetEditorClient widget={widget} />;
}
