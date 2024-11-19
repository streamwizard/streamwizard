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
    <div className="flex">
      <Sidebar>
        <SidebarNav config={dashboardConfig} user={data.user} />
      </Sidebar>
      <div className="w-full">
        <DashboardNav />
        <div className="h-[calc(100vh-60px)] overflow-x-hidden ">
          {/* <Breadcrumb /> */}
          <div className="mx-auto p-5 h-full" >{children}</div>
        </div>
      </div>
    </div>
  );
}
