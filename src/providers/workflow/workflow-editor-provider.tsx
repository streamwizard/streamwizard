"use client";

import { SaveWorkflow } from "@/app/dashboard/workflows/editor/[editorId]/_actions/workflow-connections";
import type { EditorActions, EditorNodeType, EditorState, HistoryState, Metadata, Trigger, WorkflowEditor } from "@/types/workflow";
import { usePathname } from "next/navigation";
import { Dispatch, createContext, useContext, useEffect, useReducer, useState } from "react";
import { toast } from "sonner";
import { setSelectedNode, updateMetadata, updateTrigger } from "./workflow-editor-actions";

// update metadata based on node id

const initialEditorState: EditorState["editor"] = {
  nodes: [],
  edges: [],
  selectedNode: null,
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
          selectedNode: setSelectedNode(state.editor.nodes, action.payload.id),
        },
      };

    case "UPDATE_METADATA":
      if ("id" in action.payload) {
        const new_nodes = updateMetadata(state.editor.nodes, action.payload.id, action.payload.metadata)

        return {
          ...state,
          editor: {
            ...state.editor,
            nodes: new_nodes,
            selectedNode: setSelectedNode(new_nodes, action.payload.id),
          },
        };
      }
      return state;

    case "UPDATE_TRIGGER":
      return {
        ...state,
        editor: {
          ...state.editor,
          nodes: updateTrigger(state.editor.nodes, action.payload.id, action.payload.event_id),
          selectedNode: setSelectedNode(state.editor.nodes, action.payload.id),
        },
      };

    default:
      return state;
  }
};

export type EditorContextData = {
  previewMode: boolean;
  setPreviewMode: (previewMode: boolean) => void;
};

export const WorkflowEditorContext = createContext<{
  handleSave: () => Promise<void>;
  state: EditorState;
  dispatch: Dispatch<EditorActions>;
  sidebar: string;
  setActiveSidebar: (value: "triggers" | "actions" | "settings") => void;
}>({
  handleSave: () => Promise.resolve(),
  state: initialState,
  dispatch: () => undefined,
  sidebar: "triggers",
  setActiveSidebar: () => undefined,
});

type EditorProps = {
  children: React.ReactNode;
};

const WorkFlowEditorProvider = (props: EditorProps) => {
  const [state, dispatch] = useReducer(editorReducer, initialState);
  const [sidebar, setSidebar] = useState("triggers");
  const pathname = usePathname();

  const handleSave = async () => {
    const flow = await SaveWorkflow(pathname.split("/").pop()!, state.editor.nodes, JSON.stringify(state.editor.edges));
    if (flow) toast.message(flow.message);
  };

  const setActiveSidebar = (value: string) => {
    setSidebar(value);
  }


  // useEffect(() => {
  //   console.log(state.editor);
  // }, [state.editor.selectedNode]);




  return (
    <WorkflowEditorContext.Provider
      value={{
        state,
        dispatch,
        handleSave,
        sidebar,
        setActiveSidebar
      }}
    >
      {props.children}
    </WorkflowEditorContext.Provider>
  );
};

export default WorkFlowEditorProvider;
