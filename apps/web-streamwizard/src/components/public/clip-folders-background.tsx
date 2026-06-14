import { FolderIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const folders = [
  { name: "Valorant", count: 47, color: "text-red-400" },
  { name: "Minecraft", count: 23, color: "text-green-400" },
  { name: "Funny Moments", count: 89, color: "text-yellow-400" },
  { name: "Speedruns", count: 12, color: "text-blue-400" },
  { name: "Raid Moments", count: 31, color: "text-purple-400" },
  { name: "Best of Month", count: 56, color: "text-orange-400" },
];

export function ClipFoldersBackground() {
  return (
    <div className="absolute top-4 left-4 right-4 grid grid-cols-2 gap-2 mask-[linear-gradient(to_top,transparent_30%,#000_100%)]">
      {folders.map((folder, idx) => (
        <div
          key={idx}
          className={cn(
            "flex items-center gap-2.5 rounded-lg border p-3",
            "border-gray-950/10 bg-gray-950/[0.02] hover:bg-gray-950/[0.04]",
            "dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]",
            "transform-gpu transition-all duration-200 ease-out",
            "blur-[0.5px] group-hover:blur-none"
          )}
        >
          <FolderIcon className={cn("h-5 w-5 shrink-0", folder.color)} />
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{folder.name}</p>
            <p className="text-[10px] text-muted-foreground">{folder.count} clips</p>
          </div>
        </div>
      ))}
    </div>
  );
}
