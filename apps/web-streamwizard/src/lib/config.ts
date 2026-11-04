import { Blocks, ToggleRight, User } from "lucide-react";
export const SettingsNavItems = [
  {
    label: "Account",
    href: "/dashboard/settings/account",
    icon: User,
  },
  {
    label: "Preferences",
    href: "/dashboard/settings/preferences",
    icon: ToggleRight,
  },
  {
    label: "Integrations",
    href: "/dashboard/settings/integrations",
    icon: Blocks,
  },
];
