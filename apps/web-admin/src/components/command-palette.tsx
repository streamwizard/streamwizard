"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Ticket, User } from "lucide-react";
import { Button, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, Kbd } from "@repo/ui";
import { searchUsersForPalette, type PaletteUser } from "@/actions/command-search";
import { navGroups } from "@/lib/nav-config";

// Every page and tab from the nav config, so a new nav entry is searchable for free.
const PAGES = navGroups.flatMap((group) =>
  group.items.flatMap((item) => [
    { href: item.href, label: item.label, group: group.label, icon: item.icon },
    // The first tab is the item itself.
    ...(item.tabs ?? []).slice(1).map((tab) => ({ href: tab.href, label: `${item.label}: ${tab.label}`, group: group.label, icon: item.icon })),
  ]),
);

const TICKET_NUMBER = /^#?(\d{1,7})$/;
const SEARCH_DELAY_MS = 250;

/**
 * Jump anywhere: a page, a ticket by number, a user by name. Ctrl/Cmd+K, or the
 * search button in the header (the only way in on a phone).
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<PaletteUser[]>([]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const term = query.trim();
  useEffect(() => {
    let stale = false;
    // Short terms clear the list through the same timer, so results never outlive their query.
    const timer = window.setTimeout(
      () => {
        if (term.length < 2) {
          setUsers([]);
          return;
        }
        searchUsersForPalette(term)
          .then((found) => {
            if (!stale) setUsers(found);
          })
          .catch(() => {
            if (!stale) setUsers([]);
          });
      },
      term.length < 2 ? 0 : SEARCH_DELAY_MS,
    );
    return () => {
      stale = true;
      window.clearTimeout(timer);
    };
  }, [term]);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  const ticketNumber = TICKET_NUMBER.exec(term)?.[1];

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-9 gap-2 px-2.5 text-muted-foreground md:h-8 lg:w-44 lg:justify-start"
        onClick={() => setOpen(true)}
        aria-label="Search pages, users and tickets"
      >
        <Search className="size-4" aria-hidden />
        <span className="hidden lg:inline">Search</span>
        <Kbd className="ml-auto hidden lg:inline-flex">Ctrl K</Kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search"
        description="Go to a page, a user or a ticket."
        // Top-aligned on phones so the list stays above the keyboard.
        className="top-4 translate-y-0 sm:top-[50%] sm:translate-y-[-50%]"
      >
        <CommandInput placeholder="Page, user name or ticket number" value={query} onValueChange={setQuery} className="text-base md:text-sm" />
        <CommandList>
          <CommandEmpty>Nothing matches. Try a user&apos;s name, email or Twitch name.</CommandEmpty>

          {ticketNumber && (
            <CommandGroup heading="Ticket">
              <CommandItem value={`ticket ${ticketNumber} #${ticketNumber}`} onSelect={() => go(`/discord/tickets/${ticketNumber}`)}>
                <Ticket aria-hidden />
                Open ticket #{ticketNumber}
              </CommandItem>
            </CommandGroup>
          )}

          {users.length > 0 && (
            <CommandGroup heading="Users">
              {users.map((user) => (
                // The query is in the value so cmdk's own filter keeps server matches (a Twitch name can match without appearing here).
                <CommandItem key={user.id} value={`user ${user.name} ${user.email} ${term}`} onSelect={() => go(`/users/${user.id}`)}>
                  <User aria-hidden />
                  <span className="min-w-0 truncate">{user.name}</span>
                  <span className="ml-auto min-w-0 truncate text-xs text-muted-foreground">{user.email}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandGroup heading="Pages">
            {PAGES.map((page) => (
              <CommandItem key={page.href} value={`${page.label} ${page.group}`} onSelect={() => go(page.href)}>
                <page.icon aria-hidden />
                {page.label}
                <span className="ml-auto text-xs text-muted-foreground">{page.group}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
