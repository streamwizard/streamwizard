import React from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@radix-ui/react-dropdown-menu";
import { Clapperboard } from "lucide-react";
import { Label } from "@/components/ui/label";

export default function page() {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
        <CardDescription>Manage your preferences</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-6">
          <div>
            {/* <Separator className="my-4" />} */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Clapperboard className="h-5 w-5 text-muted-foreground" />
                <Label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Automatically sync Twitch clips once your stream ends.
                </Label>
              </div>
              <Switch />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
