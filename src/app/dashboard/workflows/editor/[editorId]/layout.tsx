
import { getChannelPoints } from "@/actions/twitch/twitch-api";
import { TwitchProvider } from "@/providers/api-providers/twitch-provider";
import WorkFlowEditorProvider from "@/providers/workflow/workflow-editor-provider";
import React from "react";

interface Props {
  children: React.ReactNode;
}

export default async function WorkflowEditorLayout({ children }: Props) {
  "use memo";
  const channelpoints = await getChannelPoints();

  return (
    <div className="h-full w-full absolute top-0 left-0">
      <WorkFlowEditorProvider>
        <TwitchProvider channelpoints={channelpoints}>{children}</TwitchProvider>
      </WorkFlowEditorProvider>
    </div>
  );
}
