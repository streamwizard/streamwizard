"use client";
import { getChannelPoints } from "@/actions/twitch/twitch-api";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEditor } from "@/providers/workflow-editor-provider";
import { TwitchChannelPointsReward } from "@/types/API/twitch";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function ChannelpointsCustomRewardRedemptionAddSettings() {
  const { state, dispatch } = useEditor();
  const [channelPoints, setChannelPoints] = useState<TwitchChannelPointsReward[] | null>(null);

  useEffect(() => {
    const fetchChannelPoints = async () => {
      const res = await getChannelPoints();

      if (res === null) {
        toast.error("Failed to fetch channel points");
      }

      setChannelPoints(res);
    };

    fetchChannelPoints();
  }, [state.editor.selectedNode]);

  const handleSelect = (value: string) => {
    console.log(value);

    dispatch({
      type: "UPDATE_METADATA",
      payload: {
        id: state.editor.selectedNode.id,
        metadata: {
          rewardId: value,
        },
      },
    });
  };

  return (
    <div>
      <h4>Select reward to listen to</h4>
      <Select onValueChange={handleSelect}>
        <SelectTrigger className="w-1/2">
          <SelectValue placeholder="Select a fruit" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>ChannelPoints</SelectLabel>
            {channelPoints?.map((point) => (
              <SelectItem key={point.id} value={point.id}>
                {point.title}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
