"use client";

import { User } from "@supabase/supabase-js";
import React, { createContext, useContext } from "react";

const SessionContext = createContext<User | null>(null);

interface Props {
  children: React.ReactNode;
  session: User | null;
}

// session Provider component
export const SessionProvider = ({ children, session }: Props) => {

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
