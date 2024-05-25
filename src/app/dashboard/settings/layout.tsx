import { SidebarNav } from "@/components/nav/SidebarNav";
import { Separator } from "@/components/ui/separator";
import React from "react";
import { Settings } from "@/config/user-settings-menu";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

interface Props {
  children: React.ReactNode;
}

export default async function Layout({ children }: Props) {
  const supabase = createClient();


  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    redirect("/login");
  }



  return (
    <div className="hidden space-y-6 p-10 pb-16 md:block">
      <div className="space-y-0.5">
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>
      <Separator className="my-6" />
      <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
        <aside className="-mx-4 lg:w-1/5">
          <SidebarNav config={Settings} user={data.user}  />
        </aside>
        <div className="flex-1 lg:max-w-2xl">{children}</div>
      </div>
    </div>
  );
}
