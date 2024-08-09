"use client";
import SelectChannelpoint from "@/components/form-components/select-channelpoint";
import { useEditor } from "@/hooks/UseWorkflowEditor";
import type { Trigger } from "@/types/workflow";

export default function ChannelpointsCustomRewardRedemptionAddSettings() {
  const { state, dispatch } = useEditor();

  const handleSelect = (value: string) => {
    dispatch({
      type: "UPDATE_METADATA",
      payload: {
        id: state.editor.selectedNode!.id,
        metadata: {
          event_id: value,
        },
      },
    });
  };




  return (
    <div>
      <h4>Select reward to listen to</h4>
      <SelectChannelpoint value={(state.editor.selectedNode?.data as Trigger)?.metaData?.event_id} onValueChange={handleSelect} />{" "}
    </div>
    // <></>
  );
}
