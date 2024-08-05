'use client';
import React, { useEffect } from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectScrollDownButton, SelectValue, SelectTrigger } from "../ui/select";
import { getChannelPoints } from "@/actions/twitch/twitch-api";
import { toast } from "sonner";
import { TwitchChannelPointsReward } from "@/types/API/twitch";
import { set } from "zod";
import LoadingSpinner from "../global/loading";

interface Props {
  value?: string | null;
  onValueChange: (value: string) => void;
}

export default function SelectChannelpoint({ value, onValueChange }: Props) {
  const [channelPoints, setChannelPoints] = React.useState<TwitchChannelPointsReward[] | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);

  useEffect(() => {
    const fetchChannelPoints = async () => {
      const res = await getChannelPoints();

      if (res === null) {
        toast.error("Failed to fetch channel points");
        setLoading(false);
        return;
      }

      setChannelPoints(res);
      setLoading(false);
    };

    fetchChannelPoints();
  }, []);

  if (loading) {
    return <div>Loading channelpoints</div>
  }


  return (
    <Select onValueChange={onValueChange} value={value ? value : "" }>
      <SelectTrigger className="w-1/2">
        <SelectValue placeholder="Select a channelpoint" />
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
  );
}
