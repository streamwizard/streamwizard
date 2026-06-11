"use client";

import { parseClipView, type ClipView } from "@/lib/utils/clip-view";
import { ToggleGroup, ToggleGroupItem } from "@repo/ui";
import { LayoutGrid, LayoutList } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const VIEW_OPTIONS: { value: ClipView; label: string; icon: typeof LayoutGrid }[] = [
  { value: "grid", label: "Grid", icon: LayoutGrid },
  { value: "details", label: "Details", icon: LayoutList },
];

export function ClipsViewSelector() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const currentView = parseClipView(searchParams.get("view") ?? undefined);

  const changeView = (view: string) => {
    if (!view) return;

    const params = new URLSearchParams(searchParams);
    params.set("view", view);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
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
          <span className="hidden sm:inline">{label}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
