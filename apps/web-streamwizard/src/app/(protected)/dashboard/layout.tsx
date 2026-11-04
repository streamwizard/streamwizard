import { AppSidebar } from "@/components/nav/sidebar-app";
import { DashboardFrame } from "@/components/dashboard-frame";
import { SidebarProvider } from "@repo/ui/components/ui/sidebar";
import { createClient } from "@repo/supabase/next/server";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { ClipFolderProvider } from "@/providers/clips-provider";
import { ModalProvider } from "@/providers/modal-provider";
import { ClipFolderDialogProvider } from "@/providers/clip-folder-dialog-provider";
import { OnboardingModal } from "@/components/onboarding/onboarding-modal";
import { getClipFolders, getClipFolderClipCounts, countClipsByUserId } from "@repo/supabase/queries/clips";
import { checkProductAccess } from "@repo/supabase/queries/subscriptions";
import { getDiscordUserIdByUserIdMaybe } from "@repo/supabase/queries/user";
import { getGuildSettings } from "@repo/supabase/queries/discord";
import { getGuildMemberRoleIds } from "@/server/discord/roles";
import { env } from "@/lib/env";
import { getSessionPreferencesRow, getSessionUser } from "@/lib/session";
import { loadDashboardLayoutData } from "@/server/dashboard/layout-data";

export default async function layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  // getSessionUser and the preferences row are cached per request, so the
  // (protected) layout above and this one share the same two reads.
  const { user, folders, folderClipCounts, clipCount, onboardingCompleted, discordStatus, hasCloudObsAccess } =
    await loadDashboardLayoutData({
      getUser: getSessionUser,
      getPreferences: getSessionPreferencesRow,
      hasCloudObsAccess: () => checkProductAccess(supabase, "cloud_obs"),
      getFolders: async (userId) => (await getClipFolders(supabase, userId)).data,
      getFolderClipCounts: (userId) => getClipFolderClipCounts(supabase, userId),
      countClips: (userId) => countClipsByUserId(supabase, userId),
      getDiscordUserId: (userId) => getDiscordUserIdByUserIdMaybe(supabase, userId),
      getVerifiedRoleId: async () => (await getGuildSettings(supabaseAdmin, env.DISCORD_GUILD_ID))?.verified_role_id ?? null,
      getMemberRoleIds: getGuildMemberRoleIds,
    });

  return (
    <SidebarProvider>
      <OnboardingModal
        clipCount={clipCount}
        discordStatus={discordStatus}
        initialOnboardingCompleted={onboardingCompleted}
      />
      <ClipFolderProvider ClipFolders={folders}>
        <ModalProvider>
          <ClipFolderDialogProvider>
            <AppSidebar
              user={user}
              folders={folders}
              folderClipCounts={folderClipCounts}
              hasCloudObsAccess={hasCloudObsAccess}
              variant="inset"
            />
            <DashboardFrame>{children}</DashboardFrame>
          </ClipFolderDialogProvider>
        </ModalProvider>
      </ClipFolderProvider>
    </SidebarProvider>
  );
}
