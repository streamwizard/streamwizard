import Link from "next/link";
import { Bell, Cpu, Ticket, UserSearch, type LucideIcon } from "lucide-react";

const SHORTCUTS: { href: string; label: string; hint: string; icon: LucideIcon }[] = [
  { href: "/discord/tickets?status=needs_reply", label: "Answer tickets", hint: "Needs a reply", icon: Ticket },
  { href: "/alerts", label: "Check alerts", hint: "What is firing", icon: Bell },
  { href: "/users", label: "Find a user", hint: "Plans and bans", icon: UserSearch },
  { href: "/obs", label: "OBS nodes", hint: "Load and GPU", icon: Cpu },
];

/** The four things an admin opens this app to do. Big targets: this is the phone's home screen. */
export function Shortcuts() {
  return (
    <ul className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
      {SHORTCUTS.map((shortcut) => (
        <li key={shortcut.href}>
          <Link
            href={shortcut.href}
            className="flex min-h-16 items-center gap-3 rounded-lg border bg-card px-3 py-3 transition-colors hover:border-foreground/20 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <shortcut.icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{shortcut.label}</span>
              <span className="block truncate text-xs text-muted-foreground">{shortcut.hint}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
