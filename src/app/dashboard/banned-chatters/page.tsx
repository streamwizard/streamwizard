import { Input } from "@/components/ui/input";
import { SearchTwitchUser } from "@/components/ui/search-twitch-user";
import React from "react";

export default function page() {
  return (
    <div className="hidden h-full flex-1 flex-col  md:flex">
      <div className="flex items-center justify-between space-y-2 border rounded p-4">
        <SearchTwitchUser />
        <div className="flex items-center space-x-2"></div>
      </div>
    </div>
  );
}
