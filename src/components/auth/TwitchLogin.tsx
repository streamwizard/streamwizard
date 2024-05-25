import React from "react";
import { Button } from "../ui/button";
import Icons from "../global/icons";
import LoadingSpinner from "../global/loading";
import SocialIcon from "../global/icons";
import { login } from "@/actions/auth/login";

interface TwitchLoginProps {
  redirect: string | null;
}

export default function TwitchLogin({ redirect }: TwitchLoginProps) {
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  async function handleLogin() {
    login();
  }

  return (
    <form
      action={async () => {
        await handleLogin();
      }}
    >
      <Button variant="outline" type="button" disabled={isLoading} onClick={handleLogin}>
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <span className="mr-2 h-4 w-4 flex justify-center items-center">
            <SocialIcon icon="twitch" />
          </span>
        )}{" "}
        Twitch
      </Button>
    </form>
  );
}
