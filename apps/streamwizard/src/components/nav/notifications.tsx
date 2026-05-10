"use client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell } from "lucide-react";
import React from "react";

export default function Notifications() {
  const [notifications] = React.useState([]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Bell className="h-4 w-4 text-muted-foreground transition-all hover:text-foreground cursor-pointer" />
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div>
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Notifications</h2>
            <Button variant="ghost">Mark all as read</Button>
          </div>
          <div className="mt-4">
            {notifications.length === 0 ? (
              <div className="text-center text-muted-foreground">No notifications</div>
            ) : (
              notifications.map((notification, index) => (
                <div key={index} className="flex items-center justify-between p-2 border-b border-border">
                  <div>
                    <h3 className="text-sm font-semibold">{notification}</h3>
                    <p className="text-sm text-muted-foreground">{notification}</p>
                  </div>
                  <Button variant="ghost">Mark as read</Button>
                </div>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
