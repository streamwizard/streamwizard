import Notifications from './notifications'



export function DashboardNav() {
  return (
    <section className="flex h-[60px] select-none items-center justify-end px-6 md:border-b md:border-border md:bg-border/10">
      <div className="flex w-full items-center justify-between gap-5 p-4 text-sm">
        {/* <CommandMenu /> */}

        <div className="flex flex-row items-center gap-4">
          <Notifications />
         
          {/* <CommunitySelector /> */}
        </div>
      </div>
    </section>
  )
}