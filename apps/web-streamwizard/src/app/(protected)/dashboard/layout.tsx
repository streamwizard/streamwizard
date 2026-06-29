import { AppSidebar } from "@/components/nav/sidebar-app";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@repo/ui";
import { createClient } from "@repo/supabase/next/server";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { ClipFolderProvider } from "@/providers/clips-provider";
import { ModalProvider } from "@/providers/modal-provider";
import { ClipFolderDialogProvider } from "@/providers/clip-folder-dialog-provider";
import { OnboardingModal } from "@/components/onboarding/onboarding-modal";
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
  const { count: clipCount } = await supabase
    .from("clips")
    .select("id", { count: "exact", head: true })
    .eq("user_id", data.user.id);



  console.log("data.user.id", data.user.id);
  const { data: roleRow, error: roleError } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .maybeSingle();


  console.log("roleRow", roleRow);

  return (
    <SidebarProvider>
      <OnboardingModal clipCount={clipCount ?? 0} />
      <ClipFolderProvider ClipFolders={folders || []}>
        <ModalProvider>
          <ClipFolderDialogProvider>
            <AppSidebar user={data.user} folders={folders || []} isAdmin={!!roleRow} variant="inset" />
            <SidebarInset>
              <SiteHeader />
              <div className="w-full p-3 sm:p-5 mx-auto md:gap-6 md:py-6">{children}</div>
            </SidebarInset>
          </ClipFolderDialogProvider>
        </ModalProvider>
      </ClipFolderProvider>
    </SidebarProvider>
  );
}
