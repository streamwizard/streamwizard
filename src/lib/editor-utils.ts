import { ConnectionProviderProps } from "@/providers/connections-provider";
import { EditorCanvasCardType } from "@/types/workflow";

export const onDragStart = (event: any, nodeType: EditorCanvasCardType["type"], catagory: string) => {
  event.dataTransfer.setData("application/reactflow", `${catagory}:${nodeType}`);
  event.dataTransfer.effectAllowed = "move";
};
