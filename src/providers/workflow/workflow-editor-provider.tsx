"use client";

import type { EditorActions, EditorState } from "@/types/workflow";
import { addEdge, applyEdgeChanges, applyNodeChanges, OnConnect, OnEdgesChange, OnNodesChange } from "@xyflow/react";
import { usePathname } from "next/navigation";
import { createContext, Dispatch, use, useCallback, useEffect, useReducer } from "react";
import { toast } from "sonner";
import { setParentNodes, setSelectedNode, updateMetadata } from "./workflow-editor-actions";
import { SaveWorkflow } from "@/actions/workflows";

// update metadata based on node id

const initialEditorState: EditorState["editor"] = {
  nodes: [],
  edges: [],
  selectedNode: null,
  parentNodes: null,
  sidebar: "triggers",
};

const initialState: EditorState = {
  editor: initialEditorState,
};

const editorReducer = (state: EditorState = initialState, action: EditorActions): EditorState => {
  switch (action.type) {
    case "LOAD_DATA":
      return {
        ...state,
        editor: {
          ...state.editor,
          nodes: action.payload.nodes || initialEditorState.nodes,
          edges: action.payload.edges,
        },
      };

    case "UPDATE_NODES":
      return {
        ...state,
        editor: {
          ...state.editor,
          nodes: applyNodeChanges(action.payload.nodes, state.editor.nodes),
        },
      };

    case "UPDATE_EDGES":
      return {
        ...state,
        editor: {
          ...state.editor,
          edges: applyEdgeChanges(action.payload.edges, state.editor.edges),
        },
      };

    case "ON_CONNECT":
      return {
        ...state,
        editor: {
          ...state.editor,
          edges: addEdge(action.payload.connection, state.editor.edges),
        },
      };
    case "SELECTED_NODE":
      return {
        ...state,
        editor: {
          ...state.editor,
          selectedNode: setSelectedNode(state.editor.nodes, action.payload.id),
          parentNodes: setParentNodes(state.editor.nodes, state.editor.edges, action.payload.id!),
        },
      };

    case "ADD_NODE":
      return {
        ...state,
        editor: {
          ...state.editor,
          nodes: [...state.editor.nodes, action.payload.node],
          selectedNode: action.payload.node,
          sidebar: "settings",
        },
      };

    case "UPDATE_METADATA":
      if ("id" in action.payload) {
        const new_nodes = updateMetadata(state.editor.nodes, action.payload.id, action.payload.metadata);
        const new_selected_node = setSelectedNode(new_nodes, action.payload.id);

        return {
          ...state,
          editor: {
            ...state.editor,
            nodes: new_nodes,
            selectedNode: new_selected_node,
          },
        };
      }
      return state;

    case "SET_SIDEBAR":
      return {
        ...state,
        editor: {
          ...state.editor,
          sidebar: action.payload.sidebar,
        },
      };
 

    default:
      return state;
  }
};

interface WorkflowEditorContextType {
  handleSave: () => Promise<void>;
  state: EditorState;
  dispatch: Dispatch<EditorActions>;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
}

export const WorkflowEditorContext = createContext<WorkflowEditorContextType | null>(null);

type EditorProps = {
  children: React.ReactNode;
};

const WorkFlowEditorProvider = (props: EditorProps) => {
  const [state, dispatch] = useReducer(editorReducer, initialState);
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => dispatch({ type: "UPDATE_NODES", payload: { nodes: changes } }),
    [state.editor.nodes]
  );
  const onEdgesChange: OnEdgesChange = useCallback((changes) => dispatch({ type: "UPDATE_EDGES", payload: { edges: changes } }), [dispatch]);
  const onConnect: OnConnect = useCallback((connection) => dispatch({ type: "ON_CONNECT", payload: { connection } }), [dispatch]);

  const pathname = usePathname();

  const handleSave = async () => {
    const flow = await SaveWorkflow(pathname.split("/").pop()!, state.editor.nodes, JSON.stringify(state.editor.edges));
    if (flow) toast.message(flow.message);
  };

 


  const values: WorkflowEditorContextType = {
    handleSave,
    state,
    dispatch,
    onNodesChange,
    onEdgesChange,
    onConnect,
  };

  return <WorkflowEditorContext.Provider value={values}>{props.children}</WorkflowEditorContext.Provider>;
};

export default WorkFlowEditorProvider;
