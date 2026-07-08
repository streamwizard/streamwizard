import { redirect } from "next/navigation";
import { createClient } from "@repo/supabase/next/server";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { MonitorHeader } from "@/components/monitor-header";
import { MonitorSidebar } from "@/components/monitor-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { RefreshIntervalProvider } from "@/lib/refresh-interval-context";
import { TimeRangeProvider } from "@/lib/time-range-context";
import { BandwidthUnitProvider } from "@/lib/bandwidth-unit-context";
import { homeEnv } from "@/lib/home-env";

export default async function MonitorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/login");
  }

  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleRow) {
    redirect("/login?error=unauthorized");
  }

  return (
    <TimeRangeProvider>
      <RefreshIntervalProvider>
        <BandwidthUnitProvider>
          <SidebarProvider>
            <MonitorSidebar />
            <SidebarInset>
              <MonitorHeader envLabel={homeEnv()} />
              <main className="flex-1 overflow-auto p-6">{children}</main>
            </SidebarInset>
          </SidebarProvider>
        </BandwidthUnitProvider>
      </RefreshIntervalProvider>
    </TimeRangeProvider>
  );
}
