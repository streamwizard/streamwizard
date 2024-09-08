"use client";

import { getWorkflowByID } from "@/actions/workflows";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useEditor } from "@/hooks/UseWorkflowEditor";
import { EditorCanvasDefaultCard } from "@/lib/workflow-const";
import { Action, EditorCanvasCardType, Trigger } from "@/types/workflow";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowInstance,
  type DefaultEdgeOptions,
  type FitViewOptions,
  type Node,
  type OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { usePathname } from "next/navigation";
import { DragEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { v4 } from "uuid";
import EditorCanvasCardSingle from "./editor-canvas-card-single";
import EditorCanvasSidebar from "./editor-canvas-sidebar";

const fitViewOptions: FitViewOptions = {
  padding: 0.2,
};

const defaultEdgeOptions: DefaultEdgeOptions = {
  animated: true,
};

const onNodeDrag: OnNodeDrag = (_, node) => {};

function getActionByProviderAndType(providerName: string, actionType: string) {
  return EditorCanvasDefaultCard[providerName].actions.find((action) => action.type === actionType);
}

function getTriggerByProviderAndName(providerName: string, triggerName: string) {
  return EditorCanvasDefaultCard[providerName]?.triggers.find((trigger) => trigger.type === triggerName);
}

export default function WorkflowEditorCanvas() {
  const { dispatch, state, onConnect, onEdgesChange, onNodesChange } = useEditor();

  const { edges, nodes } = state.editor;

  const [isWorkFlowLoading, setIsWorkFlowLoading] = useState<boolean>(false);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance>();
  const nodeTypes = useMemo(() => ({ Action: EditorCanvasCardSingle, Trigger: EditorCanvasCardSingle }), []);
  const pathname = usePathname();

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      const type: EditorCanvasCardType["type"] = event.dataTransfer.getData("application/reactflow") as EditorCanvasCardType["type"];

      // check if the dropped element is valid
      if (typeof type === "undefined" || !type) {
        return;
      }

      // split the type to get the type of the node
      const typeArr = type.split(":");

      const integration = typeArr.at(0);
      const NodeType = typeArr.at(1);

      if (!integration || !NodeType) return;

      let nodeObj: Trigger | Action | undefined = getActionByProviderAndType(integration, NodeType);

      if (!nodeObj) {
        nodeObj = getTriggerByProviderAndName(integration, NodeType);
      }

      if (!nodeObj) {
        toast("Node not found");
        console.error("Node not found");
        return;
      }

      const triggerAlreadyExists = state.editor.nodes.find((node) => node.type === "Trigger");

      if (nodeObj?.nodeType === "Trigger" && triggerAlreadyExists) {
        toast("Only one trigger can be added to automations at the moment");
        return;
      }

      if (!reactFlowInstance) return;
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const id = v4();

      const newNode: Node = {
        id: id,
        position,
        type: nodeObj.nodeType,
        data: {
          ...nodeObj,
          id: id,
          integration: integration.toLowerCase(),
        },
      };

      delete newNode.data.placeholders;
      delete newNode.data.icon;

      // console.log(newNode)

      dispatch({ type: "ADD_NODE", payload: { node: newNode } });
    },
    [reactFlowInstance, state]
  );

  // OnCanvasClick
  const onCanvasClick = () => {
    dispatch({ type: "SELECTED_NODE", payload: { id: null } });
  };

  // handle delete
  const handleDelete = () => {
    if (state.editor.selectedNode) {
      dispatch({ type: "SELECTED_NODE", payload: { id: null } });
      dispatch({ type: "SET_SIDEBAR", payload: { sidebar: "settings" } });
    }
  };

  // onNodeClick
  const onNodeClick = (e: any, node: Node) => {
    e.preventDefault();
    dispatch({ type: "SELECTED_NODE", payload: { id: node.id } });
    dispatch({ type: "SET_SIDEBAR", payload: { sidebar: "settings" } });
  };

  const onGetWorkFlow = async () => {
    setIsWorkFlowLoading(true);
    const response = await getWorkflowByID(pathname.split("/").pop()!);
    if (response && response.nodes && response.edges) {
      const nodes = JSON.parse(response.nodes!);
      const edges = JSON.parse(response.edges!);
      dispatch({ type: "LOAD_DATA", payload: { nodes, edges } });

      setIsWorkFlowLoading(false);
    }
    setIsWorkFlowLoading(false);
  };

  useEffect(() => {
    onGetWorkFlow();
  }, []);

  return (
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel defaultSize={70}>
        <div className="flex h-full items-center justify-center">
          <div style={{ width: "100%", height: "100%" }} className="relative">
            {isWorkFlowLoading ? (
              <div className="absolute flex h-full w-full items-center justify-center">
                <svg
                  aria-hidden="true"
                  className="inline h-8 w-8 animate-spin fill-blue-600 text-gray-200 dark:text-gray-600"
                  viewBox="0 0 100 101"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                    fill="currentColor"
                  />
                  <path
                    d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                    fill="currentFill"
                  />
                </svg>
              </div>
            ) : (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeDrag={onNodeDrag}
                fitView
                fitViewOptions={fitViewOptions}
                defaultEdgeOptions={defaultEdgeOptions}
                nodeTypes={nodeTypes}
                colorMode="system"
                onInit={setReactFlowInstance}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onPaneClick={onCanvasClick}
                onNodesDelete={handleDelete}
                onNodeClick={(e, node) => onNodeClick(e, node)}
                onKeyDown={(e) => {
                  if (e.key === "Backspace") {
                    e.preventDefault(); // Prevent the default behavior (deleting nodes)
                  }
                }}
              >
                <MiniMap nodeStrokeWidth={3} zoomable pannable />
                <Controls />
                <Background className="!bg-black" color="#ccc" variant={BackgroundVariant.Dots} />
              </ReactFlow>
            )}
          </div>
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={30} className="relative sm:block">
        {isWorkFlowLoading ? (
          <div className="absolute flex h-full w-full items-center justify-center">
            <svg
              aria-hidden="true"
              className="inline h-8 w-8 animate-spin fill-blue-600 text-gray-200 dark:text-gray-600"
              viewBox="0 0 100 101"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                fill="currentColor"
              />
              <path
                d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                fill="currentFill"
              />
            </svg>
          </div>
        ) : (
          <EditorCanvasSidebar />
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
