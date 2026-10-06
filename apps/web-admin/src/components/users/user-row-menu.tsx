"use client";

import Link from "next/link";
import { ArrowUpRight, MoreHorizontal, Plus } from "lucide-react";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@repo/ui";
import type { UserRow } from "@/components/subscriptions/types";
import { useGrantAccess } from "./grant-access";

// Menu rows tall enough to hit with a thumb.
const ITEM = "min-h-11 md:min-h-8";

/** The "more" menu on a row of the users list. */
export function UserRowMenu({ user }: { user: UserRow }) {
  const grant = useGrantAccess();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* A labelled button at the foot of the card, an icon in the table. DataList switches on its own width, so this does too. */}
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Actions for ${user.name}`}
          className="h-11 md:h-8 @max-2xl:border @2xl:w-10 @2xl:px-0 md:@2xl:w-8"
        >
          <MoreHorizontal className="size-4" aria-hidden />
          <span className="@2xl:hidden">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem className={ITEM} onSelect={() => grant(user)}>
          <Plus aria-hidden />
          Grant access
        </DropdownMenuItem>
        <DropdownMenuItem className={ITEM} asChild>
          <Link href={`/users/${user.id}`}>
            <ArrowUpRight aria-hidden />
            Open
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
