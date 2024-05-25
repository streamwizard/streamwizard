import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

import { SidebarNav } from "@/components/nav/SidebarNav";
import { Breadcrumb } from "@/components/nav/breadcrumb";
import { DashboardNav } from "@/components/nav/dashboardNav";
import Sidebar from "@/components/nav/sidebar";
import { dashboardConfig } from "@/config/dashboard";
import { auth } from "@/auth";
import { getUser } from "@/actions/supabase/table-user";

export default async function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
    return null;
  }

  return (
    <div className="flex">
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
    </div>
  );
}
