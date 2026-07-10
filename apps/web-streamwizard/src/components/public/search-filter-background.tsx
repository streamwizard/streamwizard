"use client";

import { Badge, Button, Field, FieldLabel, Input } from "@repo/ui";
import { DatePickerWithPresets } from "@/components/date-picker";
import { SlidersHorizontal, X } from "lucide-react";

const DEMO_RANGE = {
  from: new Date(2025, 5, 1),
  to: new Date(2025, 5, 14),
};

export function SearchFilterBackground() {
  return (
    <div className="absolute top-4 left-4 right-4 pointer-events-none mask-[linear-gradient(to_top,transparent_20%,#000_100%)]">
      <div className="rounded-xl border border-border bg-card shadow-md p-3 flex flex-col gap-3 origin-top scale-90">
        {/* Active filter chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="secondary" className="gap-1 pr-1 text-xs h-7">
            Jun 1 → Jun 14
            <span className="ml-1 rounded-full p-0.5">
              <X className="h-3 w-3" />
            </span>
          </Badge>
          <Badge variant="secondary" className="gap-1 pr-1 text-xs h-7">
            Category: Valorant
            <span className="ml-1 rounded-full p-0.5">
              <X className="h-3 w-3" />
            </span>
          </Badge>
        </div>

        {/* Search + date row */}
        <div className="flex flex-wrap gap-2 items-end">
          <Field className="flex-1 min-w-[120px]">
            <FieldLabel htmlFor="demo-search">Search</FieldLabel>
            <Input
              id="demo-search"
              defaultValue="clutch moments"
              placeholder="Search clips..."
              readOnly
            />
          </Field>

          <DatePickerWithPresets
            label="Date Range"
            className="flex-1 min-w-[120px]"
            value={DEMO_RANGE}
            onChange={() => {}}
          />

          <Button type="button" variant="outline" className="gap-2 self-end shrink-0">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            <Badge className="h-5 min-w-5 rounded-full px-1 flex items-center justify-center text-xs">2</Badge>
          </Button>
        </div>
      </div>
    </div>
  );
}
