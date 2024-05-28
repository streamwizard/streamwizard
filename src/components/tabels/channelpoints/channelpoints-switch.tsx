"use client";
import { Switch } from "@/components/ui/switch";
import useChannelPoints from "@/hooks/useChannelPoints";
import { TwitchChannelPointsReward } from "@/types/API/twitch";

interface Props {
  channelPoint: TwitchChannelPointsReward;
}

export default function ChannelPointSwitch({ channelPoint }: Props) {
  const { updateChannelPoint } = useChannelPoints();

  const handleSwitch = async (value: boolean) => {
    updateChannelPoint({ ...channelPoint, is_enabled: value } as any, channelPoint.id);
  };

  return (
    <>
      <Switch checked={channelPoint.is_enabled} onCheckedChange={handleSwitch} />
    </>
  );
}
