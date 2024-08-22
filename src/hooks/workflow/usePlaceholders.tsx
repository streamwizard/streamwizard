"use client";
import { use, useEffect, useState } from "react";
import { useEditor } from "../UseWorkflowEditor";
import { getPlaceholderKeys } from "@/lib/placeholder-options";
import { v4 } from "uuid";

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
      const placeholders: Placeholder[] = parentNodes.map((node) => {
        return {
          node_id: node.id,
          label: node.data.title as string,
          type: node.data.type as string,
          options: getPlaceholderKeys(node.data.type as string),
        };
      });

      setSelectedPlaceholder(placeholders);
    }
  }, []);

  return { placeholders };
}
