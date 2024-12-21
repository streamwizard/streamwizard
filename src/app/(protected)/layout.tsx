import { createClient } from "@/lib/supabase/server";
import { SessionProvider } from "@/providers/session-provider";
import { redirect } from "next/navigation";
import React from "react";

export default async function layout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();


  if (error) {
    console.log(error);
    redirect("/login");
  }

  if (!data || !data.user) {
    redirect("/login");
  }

  return <SessionProvider session={data.user}>{children}</SessionProvider>;
}
