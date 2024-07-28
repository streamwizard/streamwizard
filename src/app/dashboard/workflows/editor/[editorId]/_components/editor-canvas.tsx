"use client";

import { useState, useCallback, useMemo, DragEventHandler, DragEvent, useEffect } from "react";
import {
  ReactFlow,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type FitViewOptions,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
  type OnNodeDrag,
  type NodeTypes,
  type DefaultEdgeOptions,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import TextUpdaterNode from "./customNodes/TextUpdaterNode";
import { Action, EditorCanvasCardType, Trigger } from "@/types/workflow";
import { toast } from "sonner";
import { v4 } from "uuid";
import { useEditor } from "@/providers/workflow-editor-provider";
import EditorCanvasCardSingle from "./editor-canvas-card-single";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import FlowInstance from "./flow-instance";
import EditorCanvasSidebar from "./editor-canvas-sidebar";
import { onGetNodesEdges } from "../../../_actions/workflow-connections";
import { usePathname } from "next/navigation";
import { EditorCanvasDefaultCard } from "../../../_utils/const";

// const initialNodes: Node[] = [
//   { id: "1", data: { label: "Node 1" }, position: { x: 5, y: 5 } },
//   { id: "2", data: { label: "Node 2" }, position: { x: 5, y: 100 } },
// ];

const initialEdges: Edge[] = [{ id: "e1-2", source: "1", target: "2" }];

const fitViewOptions: FitViewOptions = {
  padding: 0.2,
};

const defaultEdgeOptions: DefaultEdgeOptions = {
  animated: true,
};

const onNodeDrag: OnNodeDrag = (_, node) => {
  // console.log("drag event", node.data);
};

function getActionByProviderAndType(providerName: string, actionType: string) {
  return EditorCanvasDefaultCard[providerName].Actions.find((action) => action.type === actionType);
}

function getTriggerByProviderAndName(providerName: string, triggerName: string) {
  return EditorCanvasDefaultCard[providerName]?.Triggers.find((trigger) => trigger.type === triggerName);
}

export default function Flow() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isWorkFlowLoading, setIsWorkFlowLoading] = useState<boolean>(false);
  const onNodesChange: OnNodesChange = useCallback((changes) => setNodes((nds) => applyNodeChanges(changes, nds)), [setNodes]);
  const onEdgesChange: OnEdgesChange = useCallback((changes) => setEdges((eds) => applyEdgeChanges(changes, eds)), [setEdges]);
  const onConnect: OnConnect = useCallback((connection) => setEdges((eds) => addEdge(connection, eds)), [setEdges]);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance>();
  const { dispatch, state } = useEditor();
  const nodeTypes = useMemo(() => ({ textUpdater: TextUpdaterNode, Action: EditorCanvasCardSingle, Trigger: EditorCanvasCardSingle }), []);
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

      const Provider = typeArr.at(0);
      const NodeType = typeArr.at(1);

      if (!Provider || !NodeType) return;

      console.log("Provider", Provider);
      console.log("NodeType", NodeType);

      let nodeObj: Trigger | Action | undefined = getActionByProviderAndType(Provider, NodeType);

      if (!nodeObj) {
        nodeObj = getTriggerByProviderAndName(Provider, NodeType);
      }

      if (!nodeObj) {
        toast("Node not found");
        console.error("Node not found");
        return;
      }

      const triggerAlreadyExists = state.editor.nodes.find((node) => node.type === "Trigger");

      if (nodeObj?.nodeType === "Trigger" && triggerAlreadyExists) {
        toast("Only one trigger can be added to automations at the moment");
        console.log("Only one trigger can be added to automations at the moment");
        return;
      }

      if (!reactFlowInstance) return;
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node = {
        id: v4(),
        position,
        type: nodeObj.nodeType,
        data: nodeObj,
      };

      console.log("newNode", newNode);

      console.log(state.editor.nodes);

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, state]
  );

  useEffect(() => {
    dispatch({ type: "LOAD_DATA", payload: { edges, nodes: nodes } });
  }, [nodes, edges]);

  const onGetWorkFlow = async () => {
    setIsWorkFlowLoading(true);
    const response = await onGetNodesEdges(pathname.split("/").pop()!);
    if (response) {
      setEdges(JSON.parse(response.edges!));
      setNodes(JSON.parse(response.nodes!));
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
                // edgeTypes={edgeTypes}
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
      <ResizablePanel defaultSize={40} className="relative sm:block">
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
          <FlowInstance edges={edges} nodes={state.editor.nodes}>
            <EditorCanvasSidebar />
          </FlowInstance>
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
