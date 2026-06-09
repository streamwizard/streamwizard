import { SessionProvider } from "@/providers/session-provider";
import { PreferencesInitializer } from "@/components/global/preferences-initializer";
import { getSession } from "@/lib/session";
import React from "react";

export default async function layout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <SessionProvider session={session.user}>
      <PreferencesInitializer preferences={session.preferences} />
      {children}
    </SessionProvider>
  );
}
