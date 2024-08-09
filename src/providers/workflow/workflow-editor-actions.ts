import type { Metadata } from "@/types/workflow";
import { Node } from "@xyflow/react";

export const updateMetadata = (nodes: Node[], id: string, metadata: Metadata): Node[] => {
  const updatedNodes = nodes.map((node) => {
    if (node.id === id) {
      return {
        ...node,
        data: {
          ...node.data,
          metaData: {
            ...(node.data.metaData || {}),
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
export const updateTrigger = (nodes: Node[], id: string, event_id: string): Node[] => {
  const new_id = event_id.trim() === "" ? null : event_id;

  const updatedNodes: Node[] = nodes.map((node) => {
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

// set selected node
export const setSelectedNode = (nodes: Node[], id: string | null): Node | null => {
  const selectedNode = nodes.find((node) => node.id === id) || null;

  return selectedNode;
};
