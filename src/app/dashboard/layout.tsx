import { DashboardNav } from "@/components/nav/dashboardNav";
import Sidebar from "@/components/nav/sidebar";
import { SidebarNav } from "@/components/nav/SidebarNav";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { dashboardConfig } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { SessionProvider } from "@/providers/session-provider";
import { redirect } from "next/navigation";
import React from "react";

export default async function layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    console.log(error);
    redirect("/login");
  }

  if (!data || !data.user) {
    redirect("/login");
  }

  return (
    <SessionProvider session={data.user}>
      <div className="flex">
        <Sidebar>
          <SidebarNav config={dashboardConfig} user={data.user} />
        </Sidebar>
        <div className="w-full">
          <DashboardNav />
          <div className="h-[calc(100vh-60px)] overflow-x-hidden  pb-10">
            <Breadcrumb />
            <div className="mx-auto px-10">{children}</div>
          </div>
        </div>
      </div>
    </SessionProvider>
  );
}
