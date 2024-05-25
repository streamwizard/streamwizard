import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import React from "react";

export interface LayoutProps {
  children: React.ReactNode;
}

export default async function layout({ children }: LayoutProps) {
  // check if user is logged in

  const supabase = createClient();

  const { data, error } = await supabase.auth.getUser();

  if(data.user){
    redirect("/dashboard");
  }





  return <div>{children}</div>;
}
