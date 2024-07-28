"use client";

import { EditorActions, EditorNodeType } from "@/types/workflow";
import type { Node } from "@xyflow/react";
import { Dispatch, createContext, use, useContext, useEffect, useReducer } from "react";

export type EditorNode = EditorNodeType;

export type Editor = {
  nodes: Node[];
  edges: {
    id: string;
    source: string;
    target: string;
  }[];
  selectedNode: Node;
};

// update metadata based on node id
export const updateMetadata = (nodes: Node[], id: string, metadata: any): Node[] => {
  console.log("function", nodes, id, metadata);
  const updatedNodes = nodes.map((node) => {
    if (node.id === id) {
      return {
        ...node,
        data: {
          ...node.data,
          metadata: {
            test: "test",
          },
        },
      };
    }
    return node;
  });

  return updatedNodes;
};

export type HistoryState = {
  history: Editor[];
  currentIndex: number;
};

export type EditorState = {
  editor: Editor;
  history: HistoryState;
};

const initialEditorState: EditorState["editor"] = {
  nodes: [],
  selectedNode: {
    data: {
      completed: false,
      current: false,
      description: "",
      metadata: {},
      title: "",
      type: "Trigger",
    },
    id: "",
    position: { x: 0, y: 0 },
    type: "Trigger",
  },
  edges: [],
};

const initialHistoryState: HistoryState = {
  history: [initialEditorState],
  currentIndex: 0,
};

const initialState: EditorState = {
  editor: initialEditorState,
  history: initialHistoryState,
};

const editorReducer = (state: EditorState = initialState, action: EditorActions): EditorState => {
  switch (action.type) {
    case "REDO":
      if (state.history.currentIndex < state.history.history.length - 1) {
        const nextIndex = state.history.currentIndex + 1;
        const nextEditorState = { ...state.history.history[nextIndex] };
        const redoState = {
          ...state,
          editor: nextEditorState,
          history: {
            ...state.history,
            currentIndex: nextIndex,
          },
        };
        return redoState;
      }
      return state;

    case "UNDO":
      if (state.history.currentIndex > 0) {
        const prevIndex = state.history.currentIndex - 1;
        const prevEditorState = { ...state.history.history[prevIndex] };
        const undoState = {
          ...state,
          editor: prevEditorState,
          history: {
            ...state.history,
            currentIndex: prevIndex,
          },
        };
        return undoState;
      }
      return state;

    case "LOAD_DATA":
      return {
        ...state,
        editor: {
          ...state.editor,
          nodes: action.payload.nodes || initialEditorState.nodes,
          edges: action.payload.edges,
        },
      };
    case "SELECTED_NODE":
      return {
        ...state,
        editor: {
          ...state.editor,
          selectedNode: action.payload.node,
        },
      };

    case "UPDATE_METADATA":
      if ("id" in action.payload) {
        return {
          ...state,
          editor: {
            ...state.editor,
            nodes: updateMetadata(state.editor.nodes, action.payload.id, action.payload.metadata),
          },
        };
      }
      return state;
    default:
      return state;
  }
};

export type EditorContextData = {
  previewMode: boolean;
  setPreviewMode: (previewMode: boolean) => void;
};

export const WorkflowEditorContext = createContext<{
  state: EditorState;
  dispatch: Dispatch<EditorActions>;
}>({
  state: initialState,
  dispatch: () => undefined,
});

type EditorProps = {
  children: React.ReactNode;
};

const WorkFlowEditorProvider = (props: EditorProps) => {
  const [state, dispatch] = useReducer(editorReducer, initialState);

  return (
    <WorkflowEditorContext.Provider
      value={{
        state,
        dispatch,
      }}
    >
      {props.children}
    </WorkflowEditorContext.Provider>
  );
};

export const useEditor = () => {
  const context = useContext(WorkflowEditorContext);
  if (!context) {
    throw new Error("useEditor Hook must be used within the editor Provider");
  }
  return context;
};

export default WorkFlowEditorProvider;
