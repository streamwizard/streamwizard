import { DashboardConfig } from "@/types";

import { UserCog, Webhook } from "lucide-react";

export const Settings: DashboardConfig = {
  twitch: {
    title: "Settings",
    routes: [
      {
        label: "Account",
        href: "/dashboard/user/settings/account",
        icon: UserCog,
      },
      {
        label: "Intergarions",
        href: "/dashboard/user/settings/integrations",
        icon: Webhook,
      },
    ],
  },
};