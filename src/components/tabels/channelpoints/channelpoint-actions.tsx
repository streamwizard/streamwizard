"use client";
import ChannelpointForm from "@/components/forms/channelpoint-form";
import Modal from "@/components/global/modal";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import useChannelPoints from "@/hooks/useChannelPoints";
import { TwitchChannelPointsReward } from "@/types/API/twitch";
import { MoreHorizontal } from "lucide-react";
import React, { use } from "react";
import { toast } from "sonner";

interface Props {
  channelPoint: TwitchChannelPointsReward;
}

export default function ChannelPointActions({ channelPoint }: Props) {
  const [modal, setModal] = React.useState<boolean>(false);
  const { deleteChannelPoint } = useChannelPoints();

  return (
    <>
      <Modal open={modal} setModal={setModal}>
        <ChannelpointForm channelpoint={channelPoint} setModal={setModal} />
      </Modal>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0 text-right">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setModal(true)}>Edit ChannelPoint</DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              deleteChannelPoint([channelPoint]);
            }}
          >
            Delete ChannelPoint
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              navigator.clipboard.writeText(channelPoint.id);
              toast.info("channel ID copied to clipboard");
            }}
          >
            Copy ChannelPoint ID
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
