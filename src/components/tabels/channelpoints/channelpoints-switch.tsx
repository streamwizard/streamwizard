"use client";
import { Switch } from "@/components/ui/switch";
import useChannelPoints from "@/hooks/useChannelPoints";
import useCommands from "@/hooks/useCommands";
import { TwitchChannelPointsReward } from "@/types/API/twitch";
import { CommandsTable } from "@/types/database/command";

interface Props {
  channelPoint: TwitchChannelPointsReward;
}

export default function ChannelPointSwitch({ channelPoint }: Props) {
  const { updateChannelPoint } = useChannelPoints();

  const handleSwitch = async (value: boolean) => {
    updateChannelPoint({ ...channelPoint, is_enabled: value });
  };

  return (
    <>
      <Switch checked={channelPoint.is_enabled} onCheckedChange={handleSwitch} />
    </>
  );
}
