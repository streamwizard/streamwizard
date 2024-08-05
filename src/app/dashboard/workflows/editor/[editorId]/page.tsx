import WorkflowEditorCanvas from '@/components/workflows/editor-canvas'
import { WorkFlowConnectionsProvider } from '@/providers/connections-provider'
import WorkFlowEditorProvider from '@/providers/workflow/workflow-editor-provider'

type Props = {}

export default async function Page({ params }: { params: { editorId: string } }) {
  // const session = await auth();

  // const supabase = createClient(session?.supabaseAccessToken as string);
  // const { data, error } = await supabase.from("workflows").select().eq('id', params.editorId).single()






  return (
    <div className="h-full w-full absolute top-0 left-0">
      <WorkFlowEditorProvider  >
        <WorkFlowConnectionsProvider>
          <WorkflowEditorCanvas />
        </WorkFlowConnectionsProvider>
      </WorkFlowEditorProvider>
    </div>
  )
}


