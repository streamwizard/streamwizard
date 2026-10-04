"use client";

import { useId, useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
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
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/widgets/responsive-dialog";
import { TicketPanel } from "./ticket-page/ticket-panel";
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
  /** No card around it: the phone drawer. */
  flat?: boolean;
}

// 44px and 16px text on a phone (smaller text makes iOS zoom the page on focus), the usual size from 768px.
const SELECT = "h-11 text-base md:h-9 md:text-sm";
const ROW_BUTTON = "h-11 shrink-0 md:h-9";

/**
 * A value that follows the ticket row until someone edits it. The row is the
 * truth: when it changes (here or in Discord) the draft starts over from it.
 */
function useDraft(value: string): [string, (next: string) => void] {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }
  return [draft, setDraft];
}

/** The staff actions on an open ticket that aren't claim or close. Same ones `/ticket` has in Discord. */
export function TicketManage({ ticketNumber, subject, priority, category, categories, members, linked, flat }: TicketManageProps) {
  const id = useId();
  const [pending, start] = useTransition();
  const [draftSubject, setDraftSubject] = useDraft(subject);
  // Priority and category wait for their button: a slipped thumb on a select
  // shouldn't re-rank a ticket or move it to other staff roles.
  const [draftPriority, setDraftPriority] = useDraft(priority ?? "");
  const [draftCategory, setDraftCategory] = useDraft(category);
  // Each dialog keeps what it was opened for while it animates shut, so its text doesn't blank on the way out.
  const [picker, setPicker] = useState<{ mode: "add" | "transfer"; open: boolean }>({ mode: "add", open: false });
  const [removal, setRemoval] = useState<{ member: { id: string; name: string } | null; open: boolean }>({ member: null, open: false });
  const closePicker = () => setPicker((current) => ({ ...current, open: false }));
  const disabled = pending || !linked;

  const change = <K extends TicketChange>(
    kind: K,
    input: Parameters<typeof changeTicketFromDashboard<K>>[2],
    success: string,
    after?: () => void,
  ) =>
    start(async () => {
      if (toastResult(await changeTicketFromDashboard(ticketNumber, kind, input), success)) after?.();
    });

  return (
    <TicketPanel title="Manage" flat={flat} contentClassName="space-y-4 [&_[data-slot=native-select-wrapper]]:min-w-0 [&_[data-slot=native-select-wrapper]]:flex-1">
      <form
        className="space-y-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          change(
            "priority",
            { priority: (draftPriority || null) as "low" | "medium" | "high" | null },
            draftPriority ? `Priority set to ${draftPriority}.` : "Priority cleared.",
          );
        }}
      >
        <Label htmlFor={`${id}-priority`}>Priority</Label>
        <div className="flex gap-2">
          <NativeSelect
            id={`${id}-priority`}
            value={draftPriority}
            disabled={disabled}
            className={SELECT}
            onChange={(event) => setDraftPriority(event.target.value)}
          >
            <NativeSelectOption value="">None</NativeSelectOption>
            <NativeSelectOption value="low">Low</NativeSelectOption>
            <NativeSelectOption value="medium">Medium</NativeSelectOption>
            <NativeSelectOption value="high">High</NativeSelectOption>
          </NativeSelect>
          <Button type="submit" size="sm" variant="outline" className={ROW_BUTTON} disabled={disabled || draftPriority === (priority ?? "")}>
            Apply
          </Button>
        </div>
      </form>

      <form
        className="space-y-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          change("move", { category: draftCategory }, "Ticket moved.");
        }}
      >
        <Label htmlFor={`${id}-category`}>Category</Label>
        <div className="flex gap-2">
          <NativeSelect
            id={`${id}-category`}
            value={draftCategory}
            disabled={disabled}
            className={SELECT}
            onChange={(event) => setDraftCategory(event.target.value)}
          >
            {categories.map((option) => (
              <NativeSelectOption key={option.slug} value={option.slug}>
                {option.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button type="submit" size="sm" variant="outline" className={ROW_BUTTON} disabled={disabled || draftCategory === category}>
            Move
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Moving changes which staff roles can see the channel.</p>
      </form>

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
            className="h-11 md:h-9"
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className={ROW_BUTTON}
            disabled={disabled || !draftSubject.trim() || draftSubject.trim() === subject}
          >
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
                <span className="min-w-0 truncate">{member.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-11 shrink-0 text-muted-foreground md:h-8"
                  aria-label={`Remove ${member.name} from the ticket`}
                  disabled={disabled}
                  onClick={() => setRemoval({ member, open: true })}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" className="h-11 md:h-8" disabled={disabled} onClick={() => setPicker({ mode: "add", open: true })}>
            Add someone
          </Button>
          <Button size="sm" variant="outline" className="h-11 md:h-8" disabled={disabled} onClick={() => setPicker({ mode: "transfer", open: true })}>
            Hand over
          </Button>
        </div>
      </div>

      <MemberPickerDialog
        mode={picker.mode}
        open={picker.open}
        pending={pending}
        onClose={closePicker}
        onPick={(member) =>
          picker.mode === "add"
            ? change("members/add", { targetDiscordUserId: member.id }, `${member.name} added.`, closePicker)
            : change("transfer", { targetDiscordUserId: member.id }, `Handed to ${member.name}.`, closePicker)
        }
      />

      <AlertDialog open={removal.open} onOpenChange={(open) => !open && setRemoval((current) => ({ ...current, open: false }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removal.member?.name} from this ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              They lose access to the ticket channel right away. You can add them back later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 md:h-9">Keep them</AlertDialogCancel>
            <AlertDialogAction
              className="h-11 md:h-9"
              onClick={() => {
                const member = removal.member;
                if (member) change("members/remove", { targetDiscordUserId: member.id, targetName: member.name }, `${member.name} removed.`);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TicketPanel>
  );
}

// Mounted the whole time and opened by prop: ResponsiveDialog only knows it is
// on a phone after its first effect, so mounting it already open would flash a
// centred dialog before the drawer.
function MemberPickerDialog({
  mode,
  open,
  pending,
  onClose,
  onPick,
}: {
  mode: "add" | "transfer";
  open: boolean;
  pending: boolean;
  onClose: () => void;
  onPick: (member: MemberSearchResult) => void;
}) {
  return (
    <ResponsiveDialog open={open} onOpenChange={(next) => !next && onClose()}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{mode === "add" ? "Add someone to this ticket" : "Hand this ticket over"}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {mode === "add"
              ? "They can read and write in the ticket channel until you remove them."
              : "They become the ticket's owner. The current owner stays in the conversation."}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <MemberSearch mode={mode} pending={pending} onPick={onPick} />
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

/** The search inside the picker. It unmounts with the dialog, so every opening starts empty. */
function MemberSearch({
  mode,
  pending,
  onPick,
}: {
  mode: "add" | "transfer";
  pending: boolean;
  onPick: (member: MemberSearchResult) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemberSearchResult[] | null>(null);
  const [searching, startSearch] = useTransition();

  const search = () => startSearch(async () => setResults(await searchGuildMembers(query)));

  return (
    <>
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
            className="h-11 md:h-9"
          />
          <Button type="submit" variant="outline" className="h-11 shrink-0 md:h-9" disabled={searching || !query.trim()}>
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
                <Button size="sm" className="h-11 shrink-0 md:h-8" disabled={pending} onClick={() => onPick(member)}>
                  {mode === "add" ? "Add" : "Hand over"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
