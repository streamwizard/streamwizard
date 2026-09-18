"use client";

import { useMemo } from "react";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@repo/ui";
import type { PickerOption } from "@/lib/discord/options";

interface OptionGroup {
  value: string;
  items: PickerOption[];
}

// Base UI takes either a flat list or `{ value, items }` groups. Group only
// when options carry a group name, keeping first-appearance order.
function groupOptions(options: PickerOption[]): PickerOption[] | OptionGroup[] {
  if (!options.some((o) => o.group)) return options;
  const groups = new Map<string, PickerOption[]>();
  for (const option of options) {
    const key = option.group ?? "";
    groups.set(key, [...(groups.get(key) ?? []), option]);
  }
  return [...groups].map(([value, items]) => ({ value, items }));
}

const isSameOption = (a: PickerOption, b: PickerOption) => a.value === b.value;

function OptionLabel({ option }: { option: PickerOption }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {option.color && (
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: option.color }} aria-hidden />
      )}
      <span className="truncate">{option.label}</span>
    </span>
  );
}

function OptionList({ grouped, emptyText }: { grouped: boolean; emptyText: string }) {
  return (
    <>
      <ComboboxEmpty>{emptyText}</ComboboxEmpty>
      <ComboboxList>
        {grouped
          ? (group: OptionGroup) => (
              <ComboboxGroup key={group.value} items={group.items}>
                <ComboboxLabel>{group.value}</ComboboxLabel>
                <ComboboxCollection>
                  {(option: PickerOption) => (
                    <ComboboxItem key={option.value} value={option}>
                      <OptionLabel option={option} />
                    </ComboboxItem>
                  )}
                </ComboboxCollection>
              </ComboboxGroup>
            )
          : (option: PickerOption) => (
              <ComboboxItem key={option.value} value={option}>
                <OptionLabel option={option} />
              </ComboboxItem>
            )}
      </ComboboxList>
    </>
  );
}

interface PickerProps {
  id?: string;
  options: PickerOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
}

/**
 * Single-select Discord channel/role picker. Clearing the input sets `null`,
 * so nullable settings can be unset. A stored id that no longer exists in the
 * server shows as "Unknown (id)" rather than silently disappearing.
 */
export function Picker({ id, options, value, onChange, placeholder, emptyText = "Nothing found", disabled }: PickerProps) {
  const items = useMemo(() => withMissing(options, value ? [value] : []), [options, value]);
  const grouped = useMemo(() => groupOptions(items), [items]);
  const selected = value ? (items.find((o) => o.value === value) ?? null) : null;

  return (
    <Combobox<PickerOption>
      items={grouped}
      value={selected}
      onValueChange={(option) => onChange(option?.value ?? null)}
      isItemEqualToValue={isSameOption}
      disabled={disabled}
    >
      <ComboboxInput id={id} placeholder={placeholder} showClear={!!selected} disabled={disabled} className="w-full" />
      <ComboboxContent>
        <OptionList grouped={grouped !== items} emptyText={emptyText} />
      </ComboboxContent>
    </Combobox>
  );
}

interface MultiPickerProps {
  id?: string;
  options: PickerOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
}

export function MultiPicker({ id, options, value, onChange, placeholder, emptyText = "Nothing found", disabled }: MultiPickerProps) {
  const anchor = useComboboxAnchor();
  const items = useMemo(() => withMissing(options, value), [options, value]);
  const grouped = useMemo(() => groupOptions(items), [items]);
  const selected = useMemo(
    () => value.map((v) => items.find((o) => o.value === v)).filter((o): o is PickerOption => !!o),
    [items, value],
  );

  return (
    <Combobox<PickerOption, true>
      multiple
      items={grouped}
      value={selected}
      onValueChange={(options) => onChange(options.map((o) => o.value))}
      isItemEqualToValue={isSameOption}
      disabled={disabled}
    >
      <ComboboxChips ref={anchor}>
        <ComboboxValue>
          {(chips: PickerOption[]) => (
            <>
              {chips.map((option) => (
                <ComboboxChip key={option.value}>
                  <OptionLabel option={option} />
                </ComboboxChip>
              ))}
              <ComboboxChipsInput id={id} placeholder={chips.length ? undefined : placeholder} disabled={disabled} />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <OptionList grouped={grouped !== items} emptyText={emptyText} />
      </ComboboxContent>
    </Combobox>
  );
}

function withMissing(options: PickerOption[], ids: string[]): PickerOption[] {
  const missing = ids.filter((id) => !options.some((o) => o.value === id));
  if (!missing.length) return options;
  return [...options, ...missing.map((id) => ({ value: id, label: `Unknown (${id})`, group: options.some((o) => o.group) ? "Missing" : undefined }))];
}
