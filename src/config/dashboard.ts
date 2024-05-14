import { DashboardConfig } from "@/types";

import { LayoutGrid, User2 } from "lucide-react";
import { CiCalendarDate } from "react-icons/ci";
import { MdContactPage } from "react-icons/md";
import { FaMusic, FaCircle } from "react-icons/fa";
import { BsChatSquareText } from "react-icons/bs";

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
        href: "/dashboard/channel-points/",
        icon: FaCircle,
        beta: true,
      },
    ],
  },
  website: {
    title: "Song Request",
    routes: [
      {
        label: "Banned Chatters",
        href: "/dashboard/banned-chatters/",
        icon: User2,
        beta: true,
      },
      {
        label: "Banned Songs",
        href: "/dashboard/banned-songs/",
        icon: FaMusic,
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
