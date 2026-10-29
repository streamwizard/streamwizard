"use client";

import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import {
  Badge,
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui";

export interface PickerOption {
  id: string;
  label: string;
  hint?: string;
}

interface ChipPickerProps {
  label: string;
  options: PickerOption[];
  /** In order: the first is the primary one where order matters (authors). */
  value: string[];
  onChange: (ids: string[]) => void;
  max?: number;
  placeholder?: string;
  /** Offers "Add <query>" when nothing matches. Resolves to the new option. */
  onCreate?: (name: string) => Promise<PickerOption | null>;
}

/** Pick several from a searchable list. Chosen ones show as removable chips. */
export function ChipPicker({
  label,
  options,
  value,
  onChange,
  max = 50,
  placeholder = "Search…",
  onCreate,
}: ChipPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const byId = new Map(options.map((option) => [option.id, option]));
  const full = value.length >= max;

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : full ? value : [...value, id]);

  const create = async () => {
    if (!onCreate || !query.trim()) return;
    setCreating(true);
    const option = await onCreate(query.trim());
    setCreating(false);
    if (option) {
      onChange([...value, option.id]);
      setQuery("");
    }
  };

  const exact = options.some((option) => option.label.toLowerCase() === query.trim().toLowerCase());

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={label}>
          {value.map((id) => (
            <li key={id}>
              <Badge variant="secondary" className="gap-1 pr-1">
                {byId.get(id)?.label ?? "Removed"}
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  className="rounded-sm p-0.5 hover:bg-background/60"
                  aria-label={`Remove ${byId.get(id)?.label ?? "item"}`}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="h-11 md:h-8" disabled={full}>
            <Plus aria-hidden />
            {full ? `Up to ${max}` : `Add ${label.toLowerCase()}`}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty>{onCreate ? "Nothing yet. Add it below." : "Nothing matches."}</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={`${option.label} ${option.id}`}
                    onSelect={() => toggle(option.id)}
                  >
                    <Check className={value.includes(option.id) ? "size-4" : "size-4 opacity-0"} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {option.hint && <span className="text-xs text-muted-foreground">{option.hint}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
              {onCreate && query.trim() && !exact && (
                <CommandGroup>
                  <CommandItem value={`__create ${query}`} onSelect={create} disabled={creating}>
                    <Plus className="size-4" aria-hidden />
                    Add “{query.trim()}”
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
