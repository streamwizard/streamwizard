import {
  Activity,
  Bell,
  BellRing,
  Bot,
  Cloud,
  CreditCard,
  Cpu,
  Database,
  DatabaseBackup,
  DoorOpen,
  Globe,
  History,
  LayoutDashboard,
  LayoutList,
  Megaphone,
  MonitorDot,
  Network,
  Package,
  PanelTop,
  Radio,
  RadioTower,
  ScrollText,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Ticket,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type HeaderControl = "range" | "refresh" | "bandwidth";

const RANGE_REFRESH: HeaderControl[] = ["range", "refresh"];
const ALL_CONTROLS: HeaderControl[] = ["bandwidth", "range", "refresh"];

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Parent pages (e.g. /ws) match exactly; child pages match by prefix so
   * dynamic segments like /ws/topology/[roomId] keep their item active. */
  exact?: boolean;
  /** Header controls this page (and its children) actually reads. Pages
   * without any get a clean header. */
  controls?: HeaderControl[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/overview", label: "Overview", icon: LayoutDashboard }],
  },
  {
    label: "Traffic",
    items: [
      { href: "/http", label: "HTTP / API", icon: Globe, controls: RANGE_REFRESH },
      { href: "/eventsub", label: "EventSub", icon: Zap, controls: RANGE_REFRESH },
    ],
  },
  {
    label: "Realtime",
    items: [
      { href: "/ws", label: "WS Metrics", icon: Radio, exact: true, controls: RANGE_REFRESH },
      { href: "/ws/live", label: "WS Live", icon: MonitorDot },
      { href: "/ws/rooms", label: "Rooms", icon: LayoutList },
      { href: "/ws/topology", label: "Topology", icon: Network },
    ],
  },
  {
    label: "Data",
    items: [
      { href: "/database", label: "Database", icon: Database },
      { href: "/supabase", label: "Supabase", icon: Cloud, controls: RANGE_REFRESH },
    ],
  },
  {
    label: "Infrastructure",
    items: [
      { href: "/obs", label: "OBS Nodes", icon: Cpu, controls: ALL_CONTROLS },
      { href: "/ingest", label: "Ingest Servers", icon: Server, controls: ALL_CONTROLS },
      { href: "/vms", label: "VMs", icon: Server, controls: ALL_CONTROLS },
      { href: "/backups", label: "Backups", icon: DatabaseBackup, controls: RANGE_REFRESH },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/users", label: "Users", icon: Users },
      { href: "/subscriptions", label: "Subscriptions", icon: CreditCard },
      { href: "/widget-library", label: "Widget Review", icon: Package },
    ],
  },
  {
    label: "Alerts",
    items: [
      { href: "/alerts", label: "Active", icon: Bell, exact: true },
      { href: "/alerts/history", label: "History", icon: History },
      { href: "/alerts/rules", label: "Rules", icon: SlidersHorizontal },
      { href: "/alerts/notifications", label: "Notifications", icon: BellRing },
    ],
  },
  {
    label: "Discord",
    items: [
      { href: "/discord", label: "Server", icon: Bot, exact: true },
      { href: "/discord/welcome", label: "Welcome", icon: DoorOpen },
      { href: "/discord/messages", label: "Messages", icon: PanelTop },
      { href: "/discord/announcements", label: "Announcements", icon: Megaphone },
      { href: "/discord/activity", label: "Activity", icon: Activity },
      { href: "/discord/tickets", label: "Tickets", icon: Ticket },
      { href: "/discord/logs", label: "Log", icon: ScrollText },
      { href: "/discord/live", label: "Go-live", icon: RadioTower },
      { href: "/discord/permissions", label: "Permissions", icon: ShieldCheck },
    ],
  },
  {
    label: "Account",
    items: [{ href: "/security", label: "Security", icon: ShieldCheck }],
  },
];

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Group + item for the current path, longest href match wins — drives the
 * header breadcrumb. */
export function findNavLocation(pathname: string): { group: NavGroup; item: NavItem } | null {
  let best: { group: NavGroup; item: NavItem } | null = null;
  for (const group of navGroups) {
    for (const item of group.items) {
      if (!isNavItemActive(item, pathname)) continue;
      if (!best || item.href.length > best.item.href.length) best = { group, item };
    }
  }
  return best;
}
