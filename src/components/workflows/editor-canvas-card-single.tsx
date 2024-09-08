import { Badge } from "@/components/ui/badge";
import { useEffect, useMemo, useState } from "react";
import CustomHandle from "./custom-handle";
import EditorCanvasIconHelper from "./editor-canvas-card-icon-hepler";
import { MdOutlineMessage } from "react-icons/md";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { useEditor } from "@/hooks/UseWorkflowEditor";
import { cn, getNode } from "@/lib/utils";
import { Action, integrationTypes, NodeTypes } from "@/types/workflow";
import { Position, useNodeId } from "@xyflow/react";
import clsx from "clsx";
import { Zap } from "lucide-react";

const EditorCanvasCardSingle = ({ data }: { data: Action }) => {
  const { dispatch, state } = useEditor();
  const [isSelcted, setIsSelected] = useState(false);
  const nodeId = useNodeId();

  useEffect(() => {
    if (state.editor.selectedNode) {
      setIsSelected(state.editor.selectedNode.id === nodeId);
    }
  }, [state.editor.selectedNode, nodeId]);

  // TODO: Implement handleDelete
  const handleDelete = () => {};

  const Icon = () => {
    const nodeType = data.nodeType as NodeTypes;
    const integration = data.integration as unknown as string;
    const integrationType = data.type as integrationTypes;

    const Node = getNode({
      integration,
      integrationType,
      nodeType,
    });


    return Node?.icon ? <Node.icon size={30}  /> : <Zap size={30} />
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        {data.nodeType !== "Trigger" && <CustomHandle type="target" position={Position.Top} style={{ zIndex: 100 }} />}
        <Card
          className={cn("relative max-w-[400px]", {
            "dark:border-muted-foreground/70": isSelcted === true,
          })}
        >
          <CardHeader className="flex flex-row items-center gap-4">
            <div>
              <Icon />
            </div>
            <div>
              <CardTitle className="text-md">{data.title}</CardTitle>
              <CardDescription>
                <p className="text-xs text-muted-foreground/50">
                  <b className="text-muted-foreground/80">ID: </b>
                  {nodeId}
                </p>
                <p>{data.description}</p>
              </CardDescription>
            </div>
          </CardHeader>
          <Badge variant="secondary" className="absolute right-2 top-2">
            {data.nodeType}
          </Badge>
          <div
            className={clsx("absolute left-3 top-4 h-2 w-2 rounded-full", {
              "bg-green-500": Math.random() < 0.6,
              "bg-orange-500": Math.random() >= 0.6 && Math.random() < 0.8,
              "bg-red-500": Math.random() >= 0.8,
            })}
          />
        </Card>
        <CustomHandle type="source" position={Position.Bottom} id="a" />
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handleDelete}>Delete</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

export default EditorCanvasCardSingle;
