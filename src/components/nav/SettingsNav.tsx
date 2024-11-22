import React from "react";
import { SettingsNavItems } from "@/lib/config";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import Link from "next/link";

export default function SettingsNav() {
  return (
    <Card className="w-full md:w-64 h-full">
      <CardHeader>
        <CardTitle>Settings</CardTitle>
      </CardHeader>
      <CardContent className="p-3">
        <nav className="flex flex-col space-y-2">
          {SettingsNavItems.map((setting) => (
            <Link key={setting.href} href={setting.href} className="w-full">
              <Button             
                variant={"outline"}
                className="justify-start w-full"
              >
                <setting.icon className="mr-2 h-4 w-4" />
                {setting.label}
              </Button>
            </Link>
          ))}
        </nav>
      </CardContent>
    </Card>
  );
}
