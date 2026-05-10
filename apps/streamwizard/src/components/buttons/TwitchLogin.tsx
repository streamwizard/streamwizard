"use client";
import { login } from "@/actions/auth/login";
import React from "react";
import SocialIcon from "../global/icons";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";

interface TwitchLoginProps {
  redirect: string | null;
  text?: string;
  variant?: "default" | "outline" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon" | null | undefined;
  disabled?: boolean;
  className?: string;
}

export default function TwitchLogin({ text, disabled, size, variant, className }: TwitchLoginProps) {
  return (
    <Button variant={variant} size={size} type="button" onClick={() => login()} disabled={disabled}>
      <span className={cn(className, "mr-2 h-4 w-4 flex justify-center items-center ")} aria-hidden="true">
        <SocialIcon icon="twitch" />
      </span>
      {text || "Twitch"}
    </Button>
  );
}
