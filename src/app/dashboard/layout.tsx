import { redirect } from "next/navigation";

import { getUser } from "@/actions/supabase/table-user";
import { SidebarNav } from "@/components/nav/SidebarNav";
import { Breadcrumb } from "@/components/nav/breadcrumb";
import { DashboardNav } from "@/components/nav/dashboardNav";
import Sidebar from "@/components/nav/sidebar";
import { dashboardConfig } from "@/config/dashboard";
import { auth } from "@/auth";
import { SessionProvider } from "next-auth/react";
import { getChannelPoints } from "@/actions/twitch/twitch-api";
import { ChannelPointsProvider } from "@/providers/channelpoints-provider";

export default async function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  const user = await getUser();
  const channelpoints = await getChannelPoints();

  if (!user) {
    redirect("/login");
    return null;
  }


  return (
    <div className="flex">
      <SessionProvider session={session}>
        <ChannelPointsProvider initialChannelPoints={channelpoints}>
          <Sidebar>
            <SidebarNav config={dashboardConfig} user={user} />
          </Sidebar>
          <div className="w-full">
            <DashboardNav />
            <div className="h-[calc(100vh-60px)] overflow-x-hidden  pb-10">
              <Breadcrumb />
              <div className="mx-auto px-10">{children}</div>
            </div>
          </div>
        </ChannelPointsProvider>
      </SessionProvider>
    </div>
  );
}
