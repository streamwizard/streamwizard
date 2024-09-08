import { Badge } from "@/components/ui/badge";
import { DashboardConfig } from "@/types";
import { Crown } from "lucide-react";
import Link from "next/link";
import { DashboardUserNav } from "./DashboardUserNav";
import { Database } from "@/types/supabase";
import { cn } from "@/lib/utils";

interface Props {
  config: DashboardConfig;
  user: Database["public"]["Tables"]["users"]["Row"];
}

export function SidebarNav({ config, user }: Props) {
  return (
    <>
      <section className="flex flex-row, justify-between h-full w-full">
        <nav className=" flex flex-col gap-6 px-4 ">
          {Object.values(config).map((category, i) => (
            <ul key={i} className="flex flex-col gap-2">
              <h2 className="text-xs uppercase text-muted-foreground/50">{category.title ?? ""}</h2>
              {category.routes.map((route) => (
                <li key={route.href}>
                  {route.disabled ? (
                    <div className="flex h-8 cursor-not-allowed items-center justify-between gap-2 rounded-md px-2 text-sm text-muted-foreground opacity-50 grayscale">
                      <div className="flex flex-row items-center gap-2 truncate">
                        <route.icon className="h-4 w-4" />
                        <p className="truncate">{route.label}</p>
                      </div>
                      <div className="flex flex-row gap-2">
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
                        "flex h-8 items-center justify-between rounded-md px-2 text-sm text-muted-foreground hover:bg-border/80 hover:text-foreground"
                      )}
                    >
                      <div className="flex flex-row items-center gap-2 truncate">
                        <route.icon className="h-4 w-4 text-primary" />
                        <p className="truncate">{route.label}</p>
                      </div>
                      <div className="flex flex-row gap-2 truncate">
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
          <DashboardUserNav profile_img={user!.image!} username={user.name!} />
        </div>
      </div>
    </>
  );
}
