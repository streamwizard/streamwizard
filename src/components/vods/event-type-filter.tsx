"use client";

import { StreamEventType } from "@/types/stream-events";
import { getEventTypeInfo } from "@/lib/utils/stream-events";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Filter } from "lucide-react";
import { useVideoDialogStore } from "@/stores/video-dialog-store";

/**
 * Filter component for selecting which event types to display
 * Uses the video dialog store for state management
 */
export function EventTypeFilter() {
  const events = useVideoDialogStore((s) => s.events);
  const selectedEventTypes = useVideoDialogStore((s) => s.selectedEventTypes);
  const toggleEventType = useVideoDialogStore((s) => s.toggleEventType);
  const selectAllEventTypes = useVideoDialogStore((s) => s.selectAllEventTypes);
  const deselectAllEventTypes = useVideoDialogStore((s) => s.deselectAllEventTypes);

  // Get unique event types with counts (no useMemo needed with React Compiler)
  const eventTypeCounts = new Map<StreamEventType, number>();
  events.forEach((event) => {
    const type = event.event_type as StreamEventType;
    eventTypeCounts.set(type, (eventTypeCounts.get(type) || 0) + 1);
  });

  // Sort event types by count (most common first)
  const sortedEventTypes = Array.from(eventTypeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([type]) => type);

  const selectedCount = selectedEventTypes.size;
  const totalCount = eventTypeCounts.size;
  const allSelected = selectedCount === totalCount;
  const noneSelected = selectedCount === 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          Filters
          {selectedCount < totalCount && (
            <Badge variant="secondary" className="ml-1">
              {selectedCount}/{totalCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          {/* Header */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Event Type Filters</h4>
            <p className="text-xs text-muted-foreground">Select which events to show in the timeline and events panel</p>
          </div>

          {/* Quick actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAllEventTypes} disabled={allSelected} className="flex-1">
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={deselectAllEventTypes} disabled={noneSelected} className="flex-1">
              Clear All
            </Button>
          </div>

          {/* Event type list */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {sortedEventTypes.map((type) => {
              const info = getEventTypeInfo(type);
              const count = eventTypeCounts.get(type) || 0;
              const isChecked = selectedEventTypes.has(type);

              return (
                <label key={type} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                  <Checkbox checked={isChecked} onCheckedChange={() => toggleEventType(type)} />
                  <div className={`h-6 w-6 rounded-full ${info.color} flex items-center justify-center flex-shrink-0`}>
                    <info.icon className="h-3 w-3 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{info.label}</span>
                      <Badge variant="secondary" className="text-xs">
                        {count}
                      </Badge>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          {/* Summary */}
          {selectedCount < totalCount && (
            <div className="pt-2 border-t text-xs text-muted-foreground">
              Showing {selectedCount} of {totalCount} event types
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
