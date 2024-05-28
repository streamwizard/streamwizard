import { Separator } from "@/components/ui/separator";
import React from "react";

interface Props {
  children: React.ReactNode;
}

export default async function Layout({ children }: Props) {
  return (
    <div className="hidden space-y-6 p-10 pb-16 md:block">
      <div className="space-y-0.5">
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>
      <Separator className="my-6" />
      <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
        <div className="flex-1 ">{children}</div>
      </div>
    </div>
  );
}
