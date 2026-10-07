import {
  AppWindow,
  Bell,
  Bot,
  Boxes,
  Cpu,
  Database,
  DatabaseBackup,
  Globe,
  LayoutDashboard,
  Megaphone,
  Package,
  PanelTop,
  Radio,
  ScrollText,
  Server,
  Ticket,
  Users,
  Waypoints,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type HeaderControl = "range" | "refresh" | "bandwidth";

/** Live counters shown next to a nav item. Values come from /api/nav-counts. */
export type NavBadge = "tickets" | "alerts" | "widgets";

const RANGE_REFRESH: HeaderControl[] = ["range", "refresh"];
const ALL_CONTROLS: HeaderControl[] = ["bandwidth", "range", "refresh"];

export interface NavTab {
  href: string;
  label: string;
  /** The first tab of an item usually shares the item's href, so it matches exactly. */
  exact?: boolean;
  controls?: HeaderControl[];
}

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Parent pages (e.g. /discord) match exactly; child pages match by prefix so
   * dynamic segments like /users/[id] keep their item active. */
  exact?: boolean;
  /** Other path prefixes that belong to this item (its tabs living elsewhere). */
  match?: string[];
  /** Header controls this page (and its children) actually reads. Pages
   * without any get a clean header. Tabs override this per tab. */
  controls?: HeaderControl[];
  /** Sub-pages shown as a tab row at the top of the page instead of in the sidebar. */
  tabs?: NavTab[];
  badge?: NavBadge;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: "Home",
    items: [{ href: "/overview", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Support",
    items: [
      {
        href: "/discord/tickets",
        label: "Tickets",
        icon: Ticket,
        badge: "tickets",
        tabs: [
          { href: "/discord/tickets", label: "Queue", exact: true },
          { href: "/discord/tickets/stats", label: "Stats" },
          { href: "/discord/tickets/settings", label: "Settings" },
        ],
      },
      { href: "/users", label: "Users", icon: Users },
      { href: "/widget-library", label: "Widget review", icon: Package, badge: "widgets" },
    ],
  },
  {
    label: "Discord",
    items: [
      { href: "/discord/announcements", label: "Announcements", icon: Megaphone },
      { href: "/discord/messages", label: "Messages", icon: PanelTop },
      {
        href: "/discord/logs",
        label: "Event log",
        icon: ScrollText,
        tabs: [
          { href: "/discord/logs", label: "Log", exact: true },
          { href: "/discord/logs/settings", label: "Routing" },
        ],
      },
      {
        href: "/discord",
        label: "Server settings",
        icon: Bot,
        exact: true,
        match: ["/discord/welcome", "/discord/activity", "/discord/live", "/discord/permissions"],
        tabs: [
          { href: "/discord", label: "Overview", exact: true },
          { href: "/discord/welcome", label: "Welcome" },
          { href: "/discord/activity", label: "Activity tracking" },
          { href: "/discord/live", label: "Go-live" },
          { href: "/discord/permissions", label: "Permissions" },
        ],
      },
    ],
  },
  {
    label: "Monitoring",
    items: [
      {
        href: "/alerts",
        label: "Alerts",
        icon: Bell,
        badge: "alerts",
        tabs: [
          { href: "/alerts", label: "Active", exact: true },
          { href: "/alerts/history", label: "History" },
          { href: "/alerts/rules", label: "Rules" },
          { href: "/alerts/notifications", label: "Notifications" },
        ],
      },
      { href: "/http", label: "API", icon: Globe, controls: RANGE_REFRESH },
      { href: "/eventsub", label: "EventSub", icon: Zap, controls: RANGE_REFRESH },
      {
        href: "/ws",
        label: "WebSocket",
        icon: Radio,
        tabs: [
          { href: "/ws", label: "Metrics", exact: true, controls: RANGE_REFRESH },
          { href: "/ws/live", label: "Live feed" },
          { href: "/ws/rooms", label: "Rooms" },
          { href: "/ws/topology", label: "Topology" },
        ],
      },
      {
        href: "/supabase",
        label: "Database",
        icon: Database,
        match: ["/database"],
        tabs: [
          { href: "/supabase", label: "Health", controls: RANGE_REFRESH },
          { href: "/database", label: "App data" },
        ],
      },
    ],
  },
  {
    label: "Infrastructure",
    items: [
      { href: "/obs", label: "OBS nodes", icon: Cpu, controls: ALL_CONTROLS },
      { href: "/ingest", label: "Ingest servers", icon: Server, controls: ALL_CONTROLS },
      { href: "/vms", label: "VMs", icon: Boxes, controls: ALL_CONTROLS },
      { href: "/apps", label: "Apps", icon: AppWindow, controls: ALL_CONTROLS },
      { href: "/traefik", label: "Traefik", icon: Waypoints, controls: ALL_CONTROLS },
      { href: "/backups", label: "Backups", icon: DatabaseBackup, controls: RANGE_REFRESH },
    ],
  },
];

/** The four destinations pinned to the phone bottom bar; "More" opens the full drawer. */
export const BOTTOM_NAV_HREFS = ["/overview", "/discord/tickets", "/alerts", "/users"] as const;

function matchesPath(href: string, pathname: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Length of the longest prefix of this item that the path sits under, 0 when none does. */
function matchLength(item: NavItem, pathname: string): number {
  let length = matchesPath(item.href, pathname, item.exact) ? item.href.length : 0;
  for (const prefix of item.match ?? []) {
    if (matchesPath(prefix, pathname)) length = Math.max(length, prefix.length);
  }
  return length;
}

/** Group + item for the current path, longest match wins: /discord/welcome is
 * Server settings, /discord/tickets/12 is Tickets. Drives the sidebar
 * highlight, the header breadcrumb, the tab row and the header controls. */
export function findNavLocation(pathname: string): NavLocation | null {
  let best: { group: NavGroup; item: NavItem; length: number } | null = null;
  for (const group of navGroups) {
    for (const item of group.items) {
      const length = matchLength(item, pathname);
      if (length > 0 && (!best || length > best.length)) best = { group, item, length };
    }
  }
  if (!best) return null;
  return { group: best.group, item: best.item, tab: findActiveTab(best.item, pathname) };
}

/** The tab the path sits under, longest href wins. Null on detail pages that
 * belong to the item but to none of its tabs (e.g. /discord/tickets/123). */
export function findActiveTab(item: NavItem, pathname: string): NavTab | null {
  let best: NavTab | null = null;
  for (const tab of item.tabs ?? []) {
    if (!matchesPath(tab.href, pathname, tab.exact)) continue;
    if (!best || tab.href.length > best.href.length) best = tab;
  }
  return best;
}

export interface NavLocation {
  group: NavGroup;
  item: NavItem;
  tab: NavTab | null;
}

export function getHeaderControls(location: NavLocation | null): HeaderControl[] {
  if (!location) return [];
  // An item with tabs declares controls per tab: the live feed has no range.
  if (location.item.tabs) return location.tab?.controls ?? [];
  return location.item.controls ?? [];
}

export interface Crumb {
  label: string;
  /** Missing on the group label, which has no page of its own. */
  href?: string;
}

/** Group › item › tab. Detail pages add their own crumbs through <PageCrumb>. */
export function getNavTrail(location: NavLocation | null): Crumb[] {
  if (!location) return [];
  const trail: Crumb[] = [];
  if (location.group.items.length > 1) trail.push({ label: location.group.label });
  trail.push({ label: location.item.label, href: location.item.href });
  const firstTab = location.item.tabs?.[0];
  if (location.tab && location.tab !== firstTab) trail.push({ label: location.tab.label, href: location.tab.href });
  return trail;
}

export function findNavItem(href: string): NavItem | null {
  for (const group of navGroups) {
    const item = group.items.find((candidate) => candidate.href === href);
    if (item) return item;
  }
  return null;
}
