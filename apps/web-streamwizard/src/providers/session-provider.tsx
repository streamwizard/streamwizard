"use client";

import { User } from "@supabase/supabase-js";
import { hasGrantedConsent, identifyUser, onConsentGranted } from "@repo/posthog";
import React, { createContext, useContext, useEffect } from "react";

export const SessionContext = createContext<User | null>(null);

interface Props {
  children: React.ReactNode;
  session: User | null;
}

// session Provider component
export const SessionProvider = ({ children, session }: Props) => {
  useEffect(() => {
    if (!session) return;
    const identify = () =>
      identifyUser(session.id, {
        email: session.email,
        name: session.user_metadata.full_name,
        twitch_id: session.user_metadata.sub,
        avatar_url: session.user_metadata.avatar_url,
      });
    // Identify only once analytics is accepted: while consent is pending the
    // SDK drops $identify outright, and opt_in_capturing() then wipes
    // persistence, so an early identify is lost rather than delayed. Listen
    // for the grant so a user who accepts after this layout mounted is
    // linked without a full reload. Logout unlinks via resetUser().
    if (hasGrantedConsent()) identify();
    return onConsentGranted(identify);
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
