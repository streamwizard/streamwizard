import { Bell } from 'lucide-react'
import { CommandMenu } from '../ui/command-menu'
import { CommunitySelector } from '../ui/community-seclector'



export function DashboardNav() {
  return (
    <section className="flex h-[60px] select-none items-center justify-end px-6 md:border-b md:border-border md:bg-border/10">
      <div className="flex w-full items-center justify-between gap-5 p-4 text-sm">
        <CommandMenu />

        <div className="flex flex-row items-center gap-4">
          <Bell className="h-4 w-4 text-muted-foreground transition-all hover:text-foreground" />
          <CommunitySelector />
        </div>
      </div>
    </section>
  )
}