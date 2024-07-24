import { ConnectionProviderProps } from '@/providers/connections-provider'
import { useFuzzieStore } from '@/store'
import React from 'react'
import ContentBasedOnTitle from './content-based-on-title'
import { EditorState } from '@/providers/workflow-editor-provider'

type Props = {
  state: EditorState
  nodeConnection: ConnectionProviderProps
}

const RenderOutputAccordion = ({ state, nodeConnection }: Props) => {
  const {
    googleFile,
    setGoogleFile,
    selectedSlackChannels,
    setSelectedSlackChannels,
  } = useFuzzieStore()
  return (
    // <ContentBasedOnTitle
    //   nodeConnection={nodeConnection}
    //   newState={state}
    //   file={googleFile}
    //   setFile={setGoogleFile}
    //   selectedSlackChannels={selectedSlackChannels}
    //   setSelectedSlackChannels={setSelectedSlackChannels}
    // />
    <h2>ContentBasedOnTitle</h2>
  )
}

export default RenderOutputAccordion
