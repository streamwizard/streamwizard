'use client';
import { login } from "@/actions/auth/login";
import React from "react";
import SocialIcon from "../global/icons";
import LoadingSpinner from "../global/loading";
import { Button } from "../ui/button";

interface TwitchLoginProps {
  redirect: string | null;
}

export default function TwitchLogin({ redirect }: TwitchLoginProps) {
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  async function handleLogin() {
    login();
  }

  return (
    <form action={handleLogin}>
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
