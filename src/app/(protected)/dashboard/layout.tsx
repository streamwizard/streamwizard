import { DashboardNav } from "@/components/nav/dashboardNav";
import { AppSidebar } from "@/components/nav/sidebar-app";
import { SidebarProvider } from "@/components/ui/sidebar";
import { createClient } from "@/lib/supabase/server";
import { ClipFolderProvider } from "@/providers/clips-provider";
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

  const { data: folders } = await supabase.from("clip_folders").select("*");

  return (
    <SidebarProvider>
      <div className="flex w-full">
        <AppSidebar user={data.user} folders={folders || []} />
        <div className="w-full">
          <DashboardNav />
          <div className="h-[calc(100vh-60px)] overflow-x-hidden ">
            <div className="mx-auto p-5 h-full">{children}</div>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
