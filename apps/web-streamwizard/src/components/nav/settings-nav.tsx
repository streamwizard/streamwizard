"use client";

import React from "react";
import { SettingsNavItems } from "@/lib/config";
import { Card, CardHeader, CardTitle, CardContent } from "@repo/ui";
import { Button } from "@repo/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SettingsNav() {
  const pathname = usePathname();

  return (
    <Card className="w-full md:w-64 shrink-0 h-auto md:h-fit">
      <CardHeader className="hidden md:block pb-2">
        <CardTitle>Settings</CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        <nav className="flex flex-row flex-wrap gap-2 md:flex-col md:flex-nowrap md:gap-0 md:space-y-1">
          {SettingsNavItems.map((setting) => {
            const isActive = pathname === setting.href;
            return (
              <Link key={setting.href} href={setting.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className="justify-start min-h-[44px] md:w-full"
                >
                  <setting.icon className="mr-2 h-4 w-4" />
                  {setting.label}
                </Button>
              </Link>
            );
          })}
        </nav>
      </CardContent>
    </Card>
  );
}
