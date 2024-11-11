import { DashboardConfig } from "@/types/sidebar";

import { Clapperboard, LayoutGrid } from "lucide-react";
// import { BiMoviePlay } from "react-icons/bi";
export const dashboardConfig: DashboardConfig = {
  overview: {
    routes: [
      {
        label: "Overview",
        href: "/dashboard/",
        icon: Clapperboard,
        beta: true,
      },
    ],
  },
  // twitch: {
  //   title: "Twitch",
  //   routes: [
  //     {
  //       label: "CLips",
  //       href: "/dashboard/clips/",
  //       icon: Clapperboard,
  //       beta: true,
  //     },
  //   ],
  // },

  // admin: {
  //   title: 'Admin',
  //   routes: [
  //     {
  //       label: 'Admin Panel',
  //       href: '/dashboard/admin',
  //       icon: Lock,
  //     },
  //     {
  //       label: 'Analytics',
  //       href: '/dashboard/analytics',
  //       icon: AreaChart,
  //     },
  //   ],
  // },
};
