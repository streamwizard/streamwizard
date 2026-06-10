"use client";

import { CLIP_VIEWS, type ClipView } from "@/lib/utils/clip-view";
import { ToggleGroup, ToggleGroupItem } from "@repo/ui";
import { LayoutGrid, LayoutList, List } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const VIEW_OPTIONS: { value: ClipView; label: string; icon: typeof LayoutGrid }[] = [
  { value: "grid", label: "Grid", icon: LayoutGrid },
  { value: "list", label: "List", icon: List },
  { value: "details", label: "Details", icon: LayoutList },
];

type ClipsViewSelectorProps = {
  currentView: ClipView;
};

export function ClipsViewSelector({ currentView }: ClipsViewSelectorProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const changeView = (view: string) => {
    if (!view) return;

    const params = new URLSearchParams(searchParams);
    params.set("view", view);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="mb-4 flex justify-center">
      <div className="rounded-lg border border-border bg-card/50 px-2 py-1">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          value={currentView}
          onValueChange={changeView}
        >
          {VIEW_OPTIONS.map(({ value, label, icon: Icon }) => (
            <ToggleGroupItem key={value} value={value} aria-label={`${label} view`} className="gap-1.5 px-3">
              <Icon className="size-4" />
              <span>{label}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  );
}
