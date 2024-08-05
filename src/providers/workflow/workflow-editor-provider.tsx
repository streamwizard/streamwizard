"use client";

import { SaveWorkflow } from "@/app/dashboard/workflows/editor/[editorId]/_actions/workflow-connections";
import type { EditorActions, EditorNodeType, EditorState, HistoryState, Metadata, Trigger, WorkflowEditor } from "@/types/workflow";
import { usePathname } from "next/navigation";
import { Dispatch, createContext, useContext, useReducer } from "react";
import { toast } from "sonner";
import { updateMetadata, updateTrigger } from "./workflow-editor-actions";

// update metadata based on node id

const initialEditorState: EditorState["editor"] = {
  nodes: [],
  selectedNode: {
    data: {
      id: "",
      description: "",
      title: "",
      type: "none",
      event_id: "",
      nodeType: "Action",
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
            selectedNode: {
              ...state.editor.selectedNode,
              data: {
                ...state.editor.selectedNode.data,
                metaData: action.payload.metadata,
              },
            },
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
          selectedNode: {
            ...state.editor.selectedNode,
            data: {
              ...state.editor.selectedNode.data,
              event_id: action.payload.event_id,
            } as Trigger,
          },
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
}>({
  handleSave: () => Promise.resolve(),
  state: initialState,
  dispatch: () => undefined,
});

type EditorProps = {
  children: React.ReactNode;
};

const WorkFlowEditorProvider = (props: EditorProps) => {
  const [state, dispatch] = useReducer(editorReducer, initialState);
  const pathname = usePathname();

  const handleSave = async () => {
    const flow = await SaveWorkflow(pathname.split("/").pop()!, state.editor.nodes, JSON.stringify(state.editor.edges));

    if (flow) toast.message(flow.message);
  };

  return (
    <WorkflowEditorContext.Provider
      value={{
        state,
        dispatch,
        handleSave,
      }}
    >
      {props.children}
    </WorkflowEditorContext.Provider>
  );
};

export default WorkFlowEditorProvider;
