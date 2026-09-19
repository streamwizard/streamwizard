"use client";

import { User } from "@supabase/supabase-js";
import { hasGrantedConsent, identifyUser, onConsentGranted } from "@repo/posthog";
import React, { createContext, useContext, useEffect } from "react";

export const SessionContext = createContext<User | null>(null);

const INTERNAL_EMAIL_DOMAINS = ["amrio.nl"];

interface Props {
  children: React.ReactNode;
  session: User | null;
}

// session Provider component
export const SessionProvider = ({ children, session }: Props) => {
  useEffect(() => {
    if (!session) return;
    // Only what an insight can use. The account id is the link, the Twitch id
    // and display name make a person readable in the PostHog UI; email and
    // avatar were sent before but nothing read them, and PostHog is a US
    // processor, so they stay out. The "Internal / Test users" cohort used to
    // match on the email domain; it also matches this flag, so the domain
    // check moves here and the address itself never leaves the browser.
    const isInternal = INTERNAL_EMAIL_DOMAINS.some((d) => session.email?.toLowerCase().endsWith(`@${d}`));
    const identify = () =>
      identifyUser(session.id, {
        name: session.user_metadata.full_name,
        twitch_id: session.user_metadata.sub,
        ...(isInternal ? { $internal_or_test_user: true } : {}),
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
