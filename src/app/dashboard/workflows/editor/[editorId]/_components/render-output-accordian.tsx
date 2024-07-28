import { ConnectionProviderProps } from "@/providers/connections-provider";
import { useFuzzieStore } from "@/store";
import React from "react";
import ContentBasedOnTitle from "./content-based-on-title";
import { EditorState } from "@/providers/workflow-editor-provider";

type Props = {
  SettingsComponent?: React.FC;
};

const RenderOutputAccordion = ({ SettingsComponent }: Props) => {
  return <>{SettingsComponent ? <SettingsComponent /> : (
    <div>
      No settings available
    </div>
  )}</>;
};

export default RenderOutputAccordion;
