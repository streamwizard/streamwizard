"use client";
import { LinkIcon, LogOut, Moon, MoreHorizontal, Sun } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/actions/auth/logout";

export function DashboardUserNav({ username, profile_img }: { username: string; profile_img: string }) {
  const { setTheme, theme } = useTheme();
  
  const signOut = async () => {
    await logout();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="items flex h-8 w-full select-none items-center justify-between rounded-md pl-3 pr-3 text-sm text-muted-foreground transition hover:cursor-pointer hover:bg-border/50">
          <div className="flex flex-row items-center gap-2.5">
            <Avatar className="h-6 w-6 truncate border border-border">
              <AvatarImage src={profile_img} alt={`@${username}`} />
              <AvatarFallback>{username.at(0)}</AvatarFallback>
            </Avatar>
            <p className="max-w-[140px] truncate text-sm capitalize">{username}</p>
          </div>
          <MoreHorizontal className="h-3 w-3" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 select-none" align="center" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none capitalize">{username}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <Link href="/">
            <DropdownMenuItem className="cursor-pointer">
              <LinkIcon className="mr-2 h-3 w-3" />
              Home
            </DropdownMenuItem>
          </Link>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem className="cursor-pointer" asChild>
            <Link href="/dashboard/settings/">
              <LinkIcon className="mr-2 h-3 w-3" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer">
              <Sun className="mr-2 h-3 w-3 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute mr-2 ml-0 h-3 w-3 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="ml-5">Theme</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => setTheme("light")} className="cursor-pointer">
                <Sun className="mr-2 h-3 w-3" />
                Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")} className="cursor-pointer">
                <Moon className="mr-2 h-3 w-3" />
                Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")} className="cursor-pointer">
                <LinkIcon className="mr-2 h-3 w-3" />
                System
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive hover:cursor-pointer focus:bg-destructive focus:text-destructive-foreground" onClick={signOut}>
          <LogOut className="mr-2 h-3 w-3" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
