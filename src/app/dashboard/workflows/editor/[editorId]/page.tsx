import WorkflowEditorCanvas from "@/components/workflows/editor-canvas";
import { WorkFlowConnectionsProvider } from "@/providers/connections-provider";
import WorkFlowEditorProvider from "@/providers/workflow/workflow-editor-provider";

type Props = {};

export default async function Page({ params }: { params: { editorId: string } }) {
  return <WorkflowEditorCanvas />;
}
