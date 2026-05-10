import { AppSidebar } from "@/components/nav/sidebar-app";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { createClient } from "@/lib/supabase/server";
import { ClipFolderProvider } from "@/providers/clips-provider";
import { redirect } from "next/navigation";

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
      <ClipFolderProvider ClipFolders={folders || []}>
        <AppSidebar user={data.user} folders={folders || []} variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="w-full p-5 mx-auto md:gap-6 md:py-6">{children}</div>
        </SidebarInset>
      </ClipFolderProvider>
    </SidebarProvider>
  );
}
