import type { EditorNodeType, Metadata } from "@/types/workflow";

export const updateMetadata = (nodes: EditorNodeType[], id: string, metadata: Metadata): EditorNodeType[] => {
  const updatedNodes = nodes.map((node) => {
    if (node.id === id) {
      return {
        ...node,
        data: {
          ...node.data,
          metaData: {
            ...node.data.metaData,
            ...metadata,
          },
        },
      };
    }

    return node;
  });
  return updatedNodes;
};

// update trigger event ID
export const updateTrigger = (nodes: EditorNodeType[], id: string, event_id: string): EditorNodeType[] => {
  const new_id = event_id.trim() === "" ? null : event_id;

  const updatedNodes: EditorNodeType[] = nodes.map((node) => {
    if (node.id === id) {
      return {
        ...node,
        data: {
          ...node.data,
          event_id: new_id,
        },
      };
    }

    return node;
  });
  return updatedNodes;
};
