"use client";

import dynamic from "next/dynamic";

const Calendar = dynamic(() => import("@repo/ui").then((m) => m.Calendar), { ssr: false });

export function CalendarBackground() {
  return (
    <Calendar
      mode="single"
      selected={new Date(2022, 4, 11, 0, 0, 0)}
      className="absolute top-10 right-0 origin-top scale-75 rounded-md border mask-[linear-gradient(to_top,transparent_40%,#000_100%)] transition-all duration-300 ease-out group-hover:scale-90"
    />
  );
}
