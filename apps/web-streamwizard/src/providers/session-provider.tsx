"use client";

import { User } from "@supabase/supabase-js";
import posthog from "posthog-js";
import React, { createContext, useContext, useEffect } from "react";

export const SessionContext = createContext<User | null>(null);

interface Props {
  children: React.ReactNode;
  session: User | null;
}

// session Provider component
export const SessionProvider = ({ children, session }: Props) => {
  useEffect(() => {
    if (session) {
      posthog.identify(session.id, {
        email: session.email,
        name: session.user_metadata.full_name,
        twitch_id: session.user_metadata.sub,
        avatar_url: session.user_metadata.avatar_url,
      });
    } else {
      posthog.reset();
    }
  }, [session]);

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
};

// Custom hook to use the session context
export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("use session must be used within a sessionProvider");
  }
  return context;
};

// Example session component
