import React from 'react'
import EditorCanvas from './_components/editor-canvas'
import WorkFlowEditorProvider from '@/providers/workflow-editor-provider'
import { WorkFlowConnectionsProvider } from '@/providers/connections-provider'
import { auth } from '@/auth'
import { createClient } from '@/lib/supabase/server'

type Props = {}

export default async function Page({ params }: { params: { editorId: string } }) {
  // const session = await auth();

  // const supabase = createClient(session?.supabaseAccessToken as string);
  // const { data, error } = await supabase.from("workflows").select().eq('id', params.editorId).single()






  return (
    <div className="h-full w-full absolute top-0 left-0">
      <WorkFlowEditorProvider  >
        <WorkFlowConnectionsProvider>
          <EditorCanvas />
        </WorkFlowConnectionsProvider>
      </WorkFlowEditorProvider>
    </div>
  )
}


