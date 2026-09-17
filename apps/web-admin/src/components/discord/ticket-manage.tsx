"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserMinus } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
} from "@repo/ui";
import {
  changeTicketFromDashboard,
  searchGuildMembers,
  type MemberSearchResult,
  type TicketChange,
} from "@/actions/discord-ticket-actions";
import { toastResult } from "./toast-result";

interface TicketManageProps {
  ticketNumber: number;
  subject: string;
  priority: string | null;
  category: string;
  /** Categories a ticket can move to: open ones, plus the current one. */
  categories: { slug: string; name: string }[];
  members: { id: string; name: string }[];
  /** The admin's Discord account is linked, so the bot can act as them. */
  linked: boolean;
}

/** The staff actions on an open ticket that aren't claim or close. Same ones `/ticket` has in Discord. */
export function TicketManage({ ticketNumber, subject, priority, category, categories, members, linked }: TicketManageProps) {
  const router = useRouter();
  const id = useId();
  const [pending, start] = useTransition();
  const [draftSubject, setDraftSubject] = useState(subject);
  const [picking, setPicking] = useState<"add" | "transfer" | null>(null);
  const disabled = pending || !linked;

  const change = <K extends TicketChange>(
    kind: K,
    input: Parameters<typeof changeTicketFromDashboard<K>>[2],
    success: string,
    after?: () => void,
  ) =>
    start(async () => {
      if (toastResult(await changeTicketFromDashboard(ticketNumber, kind, input), success)) {
        after?.();
        router.refresh();
      }
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Manage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 [&_[data-slot=native-select-wrapper]]:w-full">
        {!linked && (
          <p className="text-xs text-muted-foreground">Link your Discord account in StreamWizard to change this ticket.</p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor={`${id}-priority`}>Priority</Label>
          <NativeSelect
            id={`${id}-priority`}
            value={priority ?? ""}
            disabled={disabled}
            onChange={(event) =>
              change(
                "priority",
                { priority: (event.target.value || null) as "low" | "medium" | "high" | null },
                event.target.value ? `Priority set to ${event.target.value}.` : "Priority cleared.",
              )
            }
          >
            <NativeSelectOption value="">None</NativeSelectOption>
            <NativeSelectOption value="low">Low</NativeSelectOption>
            <NativeSelectOption value="medium">Medium</NativeSelectOption>
            <NativeSelectOption value="high">High</NativeSelectOption>
          </NativeSelect>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${id}-category`}>Category</Label>
          <NativeSelect
            id={`${id}-category`}
            value={category}
            disabled={disabled}
            onChange={(event) => change("move", { category: event.target.value }, "Ticket moved.")}
          >
            {categories.map((option) => (
              <NativeSelectOption key={option.slug} value={option.slug}>
                {option.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <p className="text-xs text-muted-foreground">Moving changes which staff roles can see the channel.</p>
        </div>

        <form
          className="space-y-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            change("subject", { subject: draftSubject }, "Subject changed.");
          }}
        >
          <Label htmlFor={`${id}-subject`}>Subject</Label>
          <div className="flex gap-2">
            <Input
              id={`${id}-subject`}
              value={draftSubject}
              onChange={(event) => setDraftSubject(event.target.value)}
              maxLength={100}
              disabled={disabled}
            />
            <Button type="submit" size="sm" variant="outline" disabled={disabled || !draftSubject.trim() || draftSubject.trim() === subject}>
              Save
            </Button>
          </div>
        </form>

        <div className="space-y-1.5">
          <p className="text-sm font-medium">Added members</p>
          {members.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nobody besides the opener and staff.</p>
          ) : (
            <ul className="space-y-1">
              {members.map((member) => (
                <li key={member.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{member.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${member.name} from the ticket`}
                    title="Remove"
                    disabled={disabled}
                    onClick={() =>
                      change("members/remove", { targetDiscordUserId: member.id, targetName: member.name }, `${member.name} removed.`)
                    }
                  >
                    <UserMinus />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="outline" disabled={disabled} onClick={() => setPicking("add")}>
              Add someone
            </Button>
            <Button size="sm" variant="outline" disabled={disabled} onClick={() => setPicking("transfer")}>
              Hand over
            </Button>
          </div>
        </div>
      </CardContent>

      {picking && (
        <MemberPickerDialog
          mode={picking}
          pending={pending}
          onClose={() => setPicking(null)}
          onPick={(member) =>
            picking === "add"
              ? change("members/add", { targetDiscordUserId: member.id }, `${member.name} added.`, () => setPicking(null))
              : change("transfer", { targetDiscordUserId: member.id }, `Handed to ${member.name}.`, () => setPicking(null))
          }
        />
      )}
    </Card>
  );
}

function MemberPickerDialog({
  mode,
  pending,
  onClose,
  onPick,
}: {
  mode: "add" | "transfer";
  pending: boolean;
  onClose: () => void;
  onPick: (member: MemberSearchResult) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemberSearchResult[] | null>(null);
  const [searching, startSearch] = useTransition();

  const search = () => startSearch(async () => setResults(await searchGuildMembers(query)));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Add someone to this ticket" : "Hand this ticket over"}</DialogTitle>
          <DialogDescription>
            {mode === "add"
              ? "They can read and write in the ticket channel until you remove them."
              : "They become the ticket's owner. The current owner stays in the conversation."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            search();
          }}
        >
          <Label htmlFor={`${id}-query`}>Server member</Label>
          <div className="flex gap-2">
            <Input
              id={`${id}-query`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Start of their name, or a Discord id"
              maxLength={32}
              autoFocus
            />
            <Button type="submit" variant="outline" disabled={searching || !query.trim()}>
              {searching ? "Searching…" : "Search"}
            </Button>
          </div>
        </form>
        <div aria-live="polite">
          {results !== null && results.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nobody found. Discord only matches the start of a name; a Discord id always works.
            </p>
          )}
          {results && results.length > 0 && (
            <ul className="divide-y">
              {results.map((member) => (
                <li key={member.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{member.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">@{member.username}</span>
                  </span>
                  <Button size="sm" disabled={pending} onClick={() => onPick(member)}>
                    {mode === "add" ? "Add" : "Hand over"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
