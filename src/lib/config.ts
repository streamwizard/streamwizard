import { DashboardConfig } from "@/types/sidebar";

import { AreaChart, Clapperboard, LayoutGrid, Bell, Globe, Lock, Settings, User, ToggleRight, Blocks } from "lucide-react";
// import { BiMoviePlay } from "react-icons/bi";
export const dashboardConfig: DashboardConfig = {
  overview: {
    routes: [
      {
        label: "Clip Overview",
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
  //       icon: AreaChart,
  //     },
  //     {
  //       label: 'Analytics',
  //       href: '/dashboard/analytics',
  //       icon: AreaChart,
  //     },
  //   ],
  // },
};

export const SettingsNavItems = [
  // {
  //   label: "User Settings",
  //   href: "/dashboard/settings/user-settings",
  //   icon: User
  // },
  {
    label: "Preferences",
    href: "/dashboard/settings/preferences",
    icon: ToggleRight,
  },
  // {
  //   label: "Intgerations",
  //   href: "/dashboard/settings/intgerations",
  //   icon: Blocks
  // },
];
