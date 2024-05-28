import { auth } from "@/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import React from "react";

export interface LayoutProps {
  children: React.ReactNode;
}

export default async function layout({ children }: LayoutProps) {
  const session = await auth();

  if(session && session.user){
    return redirect('/dashboard')
  } 
 

  





  return <div>{children}</div>;
}
