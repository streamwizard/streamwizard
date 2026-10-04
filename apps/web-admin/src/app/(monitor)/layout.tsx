import { cookies } from "next/headers";
import { requireAdminSession } from "@/lib/admin-session";
import { MonitorHeader } from "@/components/monitor-header";
import { MonitorSidebar } from "@/components/monitor-sidebar";
import { SidebarInset, SidebarProvider } from "@repo/ui";
import { RefreshIntervalProvider } from "@/lib/refresh-interval-context";
import { TimeRangeProvider } from "@/lib/time-range-context";
import { BandwidthUnitProvider } from "@/lib/bandwidth-unit-context";
import { DASHBOARD_COOKIE } from "@/lib/dashboard-prefs";
import { homeEnv } from "@/lib/home-env";
import { getDiscordSetupGaps } from "@/lib/discord/setup-status";

export default async function MonitorLayout({ children }: { children: React.ReactNode }) {
  // Admin role + strong session (TOTP verified or passkey sign-in). Weak
  // sessions are bounced to /auth/verify or /auth/setup by the helper.
  const session = await requireAdminSession();

  // Restore the dashboard chrome settings persisted from a previous visit, so
  // the first render already reflects them (no post-hydration flash). The
  // providers parse these raw cookie strings client-side.
  const cookieStore = await cookies();
  const initialRange = cookieStore.get(DASHBOARD_COOKIE.timeRange)?.value;
  const initialInterval = cookieStore.get(DASHBOARD_COOKIE.refreshInterval)?.value;
  const initialUnit = cookieStore.get(DASHBOARD_COOKIE.bandwidthUnit)?.value;
  // Written by the sidebar itself; collapsed stays collapsed across visits.
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  // Sidebar "Not set up" badges for Discord features missing a channel.
  const setupGaps = await getDiscordSetupGaps();

  return (
    <TimeRangeProvider initialRange={initialRange}>
      <RefreshIntervalProvider initialInterval={initialInterval}>
        <BandwidthUnitProvider initialUnit={initialUnit}>
          <SidebarProvider defaultOpen={sidebarOpen}>
            <MonitorSidebar userEmail={session.email} notSetUp={[...setupGaps]} />
            {/* SidebarInset is the <main>. min-w-0 keeps wide content from
                pushing the page sideways; overflow-x-clip (not auto) so sticky
                bars inside a page still stick to the viewport. */}
            <SidebarInset className="min-w-0">
              <MonitorHeader envLabel={homeEnv()} />
              <div className="min-w-0 flex-1 overflow-x-clip p-4 md:p-6">{children}</div>
            </SidebarInset>
          </SidebarProvider>
        </BandwidthUnitProvider>
      </RefreshIntervalProvider>
    </TimeRangeProvider>
  );
}
