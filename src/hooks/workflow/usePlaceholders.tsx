"use client";
import { getNode } from "@/lib/utils";
import { integrationTypes, NodeTypes } from "@/types/workflow";
import { useEffect, useState } from "react";
import { useEditor } from "../UseWorkflowEditor";

interface Placeholder {
  node_id: string;
  label: string;
  type: string;
  options: string[];
  uuid?: string;
}

export default function usePlaceholders() {
  const [placeholders, setSelectedPlaceholder] = useState<Placeholder[]>([]);
  const {
    state: {
      editor: { parentNodes },
    },
  } = useEditor();

  useEffect(() => {
    if (parentNodes) {
      const placeholders = parentNodes.map((node) => {
        // console.log(node)

        const nodeType = node.type as NodeTypes;
        const integration = node.data.integration as string;
        const integrationType = node.data.type as integrationTypes;

        const Node = getNode({
          integrationType,
          nodeType,
          integration,
        });

        return {
          node_id: node.id,
          label: node.data.title as string,
          type: node.data.type as string,
          options: (Node?.placeholders as string[]) || [],
        };
      });

      // remove all the placeholders that have no options
      const filteredPlaceholders = placeholders.filter((placeholder) => placeholder.options.length > 0);

      setSelectedPlaceholder(filteredPlaceholders);
    }
  }, [parentNodes]);

  return { placeholders };
}
