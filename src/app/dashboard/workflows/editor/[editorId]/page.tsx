import WorkflowEditorCanvas from "@/components/workflows/editor-canvas";

export default async function Page({ params }: { params: { editorId: string } }) {
  return <WorkflowEditorCanvas />;
}
