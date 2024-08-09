"use client";
import { useTwitchProvider } from "@/hooks/useTwitchProvider";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "../ui/select";

interface Props {
  value?: string | null
  onValueChange: (value: string) => void;
}

export default function SelectChannelpoint({ value, onValueChange }: Props) {
  const { channelPoints } = useTwitchProvider();

  return (
    <Select onValueChange={onValueChange} value={value ? value :  ""}>
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
