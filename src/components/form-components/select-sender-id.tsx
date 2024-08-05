"use client";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "../ui/select";
import { useSession } from "next-auth/react";

interface Props {
  value?: string | null;
  onValueChange: (value: string) => void;
}

export default function SelectSenderID({ value, onValueChange }: Props) {
  const { data } = useSession();

  if (!data) {
    return null;
  }

  return (
    <Select onValueChange={onValueChange} value={value ? value : ""}>
      <SelectTrigger className="w-1/2">
        <SelectValue placeholder="Select a sender" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Sender</SelectLabel>
          {/* <SelectItem value={data.user.channel_id}>{data.user.name}</SelectItem> */}
          <SelectItem value="956066753">StreamWizardBot</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
