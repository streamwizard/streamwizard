import { AppSidebar } from "@/components/nav/sidebar-app";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@repo/ui";
import { createClient } from "@repo/supabase/next/server";
import { ClipFolderProvider } from "@/providers/clips-provider";
import { redirect } from "next/navigation";
import { getClipFolders } from "@repo/supabase/queries/clips";

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

  const { data: folders } = await getClipFolders(supabase, data.user.id);
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
