import { DashboardConfig } from "@/types";

import { LayoutGrid, User2 } from "lucide-react";
import { BsChatSquareText } from "react-icons/bs";
import { FaCircle } from "react-icons/fa";
import { FaCodeFork } from "react-icons/fa6";
export const dashboardConfig: DashboardConfig = {
  overview: {
    routes: [
      {
        label: "Overview",
        href: "/dashboard/",
        icon: LayoutGrid,
      },
    ],
  },
  twitch: {
    title: "Twitch",
    routes: [
      {
        label: "Commands",
        href: "/dashboard/commands/",
        icon: BsChatSquareText,
        beta: true,
      },
      {
        label: "Channel Points",
        href: "/dashboard/channelpoints/",
        icon: FaCircle,
        beta: true,
      },
      {
        label: "Workflows",
        href: "/dashboard/workflows/",
        icon: FaCodeFork ,
        beta: true,
      },
    ],
  },


  community: {
    title: "Community",
    routes: [
      {
        label: "User Management",
        href: "/dashboard/user-management/",
        icon: User2,
        disabled: true,
        commingSoon: true,
      },
    ],
  },

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
