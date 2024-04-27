"use client";

import { OauthRedirect } from "@/actions/integrations/redirect";
import Icons from "@/components/global/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import React from "react";
import { DeleteIntegrations } from "@/actions/integrations/Disconnect";
import { toast } from "sonner";

interface Props {
  integrations: string;
  connected: boolean;
}

export function IntegrationsConnectButton({ integrations, connected }: Props) {
  const [hover, setHover] = React.useState(false);

  const handleClick = async () => {
    if (connected) {
      const {error, message} = await DeleteIntegrations(integrations);
      if(error) {
        toast.error(error);
        return;
      }


      return;
    }

    OauthRedirect(integrations);
  };

  const startHover = () => setHover(true);
  const endHover = () => setHover(false);

  return (
    <Button variant="outline" onClick={handleClick} onMouseEnter={startHover} onMouseLeave={endHover} className={cn("w-32",{
      "hover:bg-green-600": !connected,
      "hover:bg-red-600": connected,
    })}>
      <Icons icon={integrations} />
      <span className="ml-2 ">{connected ? (hover ? "Disconnect" : "Connected") : "Connect"}</span>
    </Button>
  );
}
