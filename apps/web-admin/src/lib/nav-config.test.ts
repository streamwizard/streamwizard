import { describe, expect, test } from "bun:test";
import { BOTTOM_NAV_HREFS, findNavItem, findNavLocation, getHeaderControls, getNavTrail, navGroups } from "./nav-config";

const at = (pathname: string) => {
  const location = findNavLocation(pathname);
  return location ? { item: location.item.label, tab: location.tab?.label ?? null } : null;
};

describe("findNavLocation", () => {
  test("every nav item resolves to itself", () => {
    for (const group of navGroups) {
      for (const item of group.items) {
        expect(findNavLocation(item.href)?.item).toBe(item);
      }
    }
  });

  test("every tab resolves to its own item and tab", () => {
    for (const group of navGroups) {
      for (const item of group.items) {
        for (const tab of item.tabs ?? []) {
          const location = findNavLocation(tab.href);
          expect(location?.item).toBe(item);
          expect(location?.tab).toBe(tab);
        }
      }
    }
  });

  test("Discord splits between Server settings, Tickets and the rest", () => {
    expect(at("/discord")).toEqual({ item: "Server settings", tab: "Overview" });
    expect(at("/discord/welcome")).toEqual({ item: "Server settings", tab: "Welcome" });
    expect(at("/discord/live")).toEqual({ item: "Server settings", tab: "Go-live" });
    expect(at("/discord/tickets")).toEqual({ item: "Tickets", tab: "Queue" });
    expect(at("/discord/tickets/settings/categories/abc")).toEqual({ item: "Tickets", tab: "Settings" });
    expect(at("/discord/logs/settings")).toEqual({ item: "Event log", tab: "Routing" });
    expect(at("/discord/messages/abc")).toEqual({ item: "Messages", tab: null });
    expect(at("/discord/announcements")).toEqual({ item: "Announcements", tab: null });
  });

  test("a single ticket belongs to Tickets but to none of its tabs", () => {
    // The bot links here, and the tab row must stay hidden on it.
    expect(at("/discord/tickets/42")).toEqual({ item: "Tickets", tab: null });
  });

  test("detail pages keep their item", () => {
    expect(at("/users/abc/tickets")).toEqual({ item: "Users", tab: null });
    expect(at("/obs/node-1/instances/inst-1")).toEqual({ item: "OBS nodes", tab: null });
    expect(at("/vms/hosts/pve1")).toEqual({ item: "VMs", tab: null });
    expect(at("/ws/topology/room-1")).toEqual({ item: "WebSocket", tab: "Topology" });
  });

  test("Database covers both /supabase and /database", () => {
    expect(at("/supabase")).toEqual({ item: "Database", tab: "Health" });
    expect(at("/database")).toEqual({ item: "Database", tab: "App data" });
  });

  test("pages outside the nav have no location", () => {
    expect(findNavLocation("/security")).toBeNull();
    expect(findNavLocation("/discordant")).toBeNull();
  });
});

describe("getHeaderControls", () => {
  const controls = (pathname: string) => getHeaderControls(findNavLocation(pathname));

  test("only pages that read a control get it", () => {
    expect(controls("/overview")).toEqual([]);
    expect(controls("/users")).toEqual([]);
    expect(controls("/http")).toEqual(["range", "refresh"]);
    expect(controls("/obs/node-1")).toEqual(["bandwidth", "range", "refresh"]);
  });

  test("tabs decide for themselves", () => {
    expect(controls("/ws")).toEqual(["range", "refresh"]);
    expect(controls("/ws/live")).toEqual([]);
    expect(controls("/supabase")).toEqual(["range", "refresh"]);
    expect(controls("/database")).toEqual([]);
  });
});

describe("getNavTrail", () => {
  const trail = (pathname: string) => getNavTrail(findNavLocation(pathname)).map((crumb) => crumb.label);

  test("group, item, and the tab when it isn't the first", () => {
    expect(trail("/alerts")).toEqual(["Monitoring", "Alerts"]);
    expect(trail("/alerts/rules")).toEqual(["Monitoring", "Alerts", "Rules"]);
    expect(trail("/discord/tickets/42")).toEqual(["Support", "Tickets"]);
  });

  test("a one-item group doesn't repeat itself", () => {
    expect(trail("/overview")).toEqual(["Dashboard"]);
  });
});

test("the bottom bar only points at real nav items", () => {
  for (const href of BOTTOM_NAV_HREFS) expect(findNavItem(href)).not.toBeNull();
});
