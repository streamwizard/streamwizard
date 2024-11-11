import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DashboardConfig } from "@/types/sidebar";
import { User } from "@supabase/supabase-js";
import { Crown } from "lucide-react";
import Link from "next/link";
import { DashboardUserNav } from "./DashboardUserNav";

interface Props {
  config: DashboardConfig;
  user: User;
}

export function SidebarNav({ config, user }: Props) {
  return (
    <>
      <section className="flex flex-row, justify-between h-full w-full">
        <nav className=" flex flex-col gap-6 px-4  w-full">
          {Object.values(config).map((category, i) => (
            <ul key={i} className="flex flex-col gap-2">
              <h2 className="text-xs uppercase text-muted-foreground/50">{category.title ?? ""}</h2>
              {category.routes.map((route) => (
                <li key={route.href} className="w-full">
                  {route.disabled ? (
                    <div className="flex h-8 cursor-not-allowed items-center justify-between gap-2 rounded-md px-2 text-sm text-muted-foreground opacity-50 grayscale">
                      <div className="flex flex-row items-center gap-2 truncate">
                        <route.icon className="h-4 w-4" />
                        <p className="truncate">{route.label}</p>
                      </div>
                      <div className="flex flex-row gap-2 ml-4">
                        {route.premium && <Crown className="h-4 w-4" />}
                        {route.new && <Badge className="pointer-events-none h-4 rounded px-1.5 text-[0.65rem] text-muted">new</Badge>}
                        {route.beta && <Badge className="pointer-events-none h-4 rounded px-1.5 text-[0.65rem] text-muted">beta</Badge>}
                        {route.commingSoon && <Badge className="pointer-events-none h-4 rounded px-1.5 text-[0.65rem] text-muted">Soon</Badge>}
                      </div>
                    </div>
                  ) : (
                    <Link
                      href={route.href}
                      className={cn(
                        "flex h-8 items-center justify-between rounded-md px-2 text-sm text-muted-foreground hover:bg-border/80 hover:text-foreground w-full"
                      )}
                    >
                      <div className="flex flex-row items-center gap-2 truncate">
                        <route.icon className="h-4 w-4 text-primary" />
                        <p className="truncate">{route.label}</p>
                      </div>
                      <div className="flex flex-row gap-2 truncate ">
                        {route.premium && <Crown className="h-4 w-4 text-amber-500" />}
                        {route.new && <Badge className="pointer-events-none h-4 rounded px-1.5 text-[0.65rem] text-muted">new</Badge>}
                        {route.beta && <Badge className="pointer-events-none h-4 rounded px-1.5 text-[0.65rem] text-muted">Beta</Badge>}
                        {route.commingSoon && (
                          <Badge className="pointer-events-none h-4 w-4 rounded px-1.5 text-[0.65rem] text-muted truncate">Soon</Badge>
                        )}
                      </div>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          ))}
        </nav>
      </section>

      <div className="px-4 py-6">
        <div className="flex flex-1 items-center gap-3 overflow-hidden">
          <DashboardUserNav profile_img={user?.user_metadata.avatar_url} username={user?.user_metadata.nickname} />
        </div>
      </div>
    </>
  );
}
