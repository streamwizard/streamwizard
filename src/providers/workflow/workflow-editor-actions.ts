import type { Metadata } from "@/types/workflow";
import { Edge, Node } from "@xyflow/react";

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

// return all parent nodes
export const setParentNodes = (nodes: Node[], edges: Edge[], id: string): Node[] | null => {
  const visited = new Set<string>();

  // Recursive function to find all parent nodes
  const findParents = (nodeId: string): Node[] => {
    // Mark the current node as visited
    visited.add(nodeId);

    // Find direct parent nodes
    const directParents = edges
      .filter((edge) => edge.target === nodeId)
      .map((edge) => nodes.find((node) => node.id === edge.source))
      .filter((node): node is Node => node !== undefined); // Remove undefined entries

    // For each direct parent, find its parents recursively
    const allParents = directParents.flatMap((parentNode) => {
      if (!visited.has(parentNode.id)) {
        return [parentNode, ...findParents(parentNode.id)];
      }
      return [parentNode];
    });

    return allParents;
  };

  // Start the recursion with the given node id
  const parentNodes = findParents(id);

  // return null if no parent nodes found
  if (parentNodes.length === 0) {
    return null;
  }

  // Remove duplicates by using a Set
  return Array.from(new Map(parentNodes.map((node) => [node.id, node])).values());
};
