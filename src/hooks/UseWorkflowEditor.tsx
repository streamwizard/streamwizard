import { WorkflowEditorContext } from "@/providers/workflow/workflow-editor-provider";
import { useContext } from "react";

export const useEditor = () => {
  const context = useContext(WorkflowEditorContext);
  if (!context) {
    throw new Error("useEditor Hook must be used within the editor Provider");
  }
  return context;
};