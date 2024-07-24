import { Badge } from "@/components/ui/badge";
import { useMemo } from "react";
import CustomHandle from "./custom-handle";
import EditorCanvasIconHelper from "./editor-canvas-card-icon-hepler";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { useEditor } from "@/providers/workflow-editor-provider";
import { EditorCanvasCardType } from "@/types/workflow";
import { Node, Position, useNodeId } from "@xyflow/react";
import clsx from "clsx";

const EditorCanvasCardSingle = ({ data }: { data: Node }) => {
  const { dispatch, state } = useEditor();
  const nodeId = useNodeId();
  const logo = useMemo(() => {
    return <EditorCanvasIconHelper type={data.type as any} />;
  }, [data]);

  

  
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        {data.type !== "Trigger" && data.type !== "Google Drive" && <CustomHandle type="target" position={Position.Top} style={{ zIndex: 100 }} />}
        <Card
          onClick={(e) => {
            e.stopPropagation();
            const val = state.editor.nodes.find((n) => n.id === nodeId);
            if (val)
              dispatch({
                type: "SELECTED_NODE",
                payload: {
                  node: val,
                },
              });
          }}
          className="relative max-w-[400px] dark:border-muted-foreground/70"
        >
          <CardHeader className="flex flex-row items-center gap-4">
            <div>{logo}</div>
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
            {data.type}
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
        <ContextMenuItem>Delete</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

export default EditorCanvasCardSingle;