import { redirect } from "next/navigation";
import { createClient } from "@repo/supabase/next/server";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { MonitorSidebar } from "@/components/monitor-sidebar";
import { RefreshIntervalProvider } from "@/lib/refresh-interval-context";
import { TimeRangeProvider } from "@/lib/time-range-context";

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
        <div className="flex h-screen overflow-hidden">
          <MonitorSidebar />
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </RefreshIntervalProvider>
    </TimeRangeProvider>
  );
}
