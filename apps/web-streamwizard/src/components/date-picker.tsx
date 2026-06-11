"use client";

import { format, startOfDay, startOfMonth, startOfWeek, startOfYear, subDays, subMonths, subWeeks, subYears } from "date-fns";
import { CalendarIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@repo/ui";
import { Calendar } from "@repo/ui";
import { Field, FieldLabel } from "@repo/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui";
import { cn } from "@/lib/utils";

export type DateRange = { from?: Date; to?: Date };

interface DatePickerWithPresetsProps {
  value?: DateRange;
  /** Called only with a complete range (from + to) or undefined when cleared */
  onChange: (range: DateRange | undefined) => void;
  label?: string;
  className?: string;
}

export function DatePickerWithPresets({ value, onChange, label, className }: DatePickerWithPresetsProps) {
  const [month, setMonth] = React.useState<Date>(new Date());
  // In-progress selection lives here so a half-picked range survives re-renders
  const [range, setRange] = React.useState<DateRange | undefined>(value);

  React.useEffect(() => {
    setRange(value);
  }, [value]);

  function handleSelect(next: DateRange | undefined) {
    setRange(next);
    if (!next) {
      onChange(undefined);
    } else if (next.from && next.to) {
      onChange(next);
    }
  }

  const presets = [
    {
      name: "Today",
      dates: () => ({
        from: startOfDay(new Date()),
        to: startOfDay(new Date()),
      }),
    },
    {
      name: "Yesterday",
      dates: () => ({
        from: startOfDay(subDays(new Date(), 1)),
        to: startOfDay(subDays(new Date(), 1)),
      }),
    },
    {
      name: "Last Week",
      dates: () => ({
        from: startOfWeek(subWeeks(new Date(), 0)),
        to: startOfDay(subDays(new Date(), 0)),
      }),
    },
    {
      name: "Last 2 Weeks",
      dates: () => ({
        from: startOfWeek(subWeeks(new Date(), 1)),
        to: startOfDay(subDays(new Date(), 0)),
      }),
    },
    {
      name: "Last Month",
      dates: () => ({
        from: startOfMonth(subMonths(new Date(), 0)),
        to: startOfDay(subDays(new Date(), 0)),
      }),
    },
    {
      name: "Last Year",
      dates: () => ({
        from: startOfYear(subYears(new Date(), 0)),
        to: startOfDay(subDays(new Date(), 0)),
      }),
    },
  ];

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

  const disabledDays = { after: new Date() };

  return (
    <Field className={cn("flex flex-col", className)}>
      {label && <FieldLabel htmlFor="date-range">{label}</FieldLabel>}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date-range"
            type="button"
            variant={"outline"}
            className={cn("w-full justify-start text-left font-normal cursor-pointer", !range?.from && "text-muted-foreground")}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {range?.from
              ? `${format(range.from, "MMM d, yyyy")} - ${range.to ? format(range.to, "MMM d, yyyy") : "…"}`
              : "Select Date Range"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="center">
          <div className="flex">
            <div className="flex flex-col space-y-2 p-2 border-r">
              {presets.map((preset) => (
                <Button
                  key={preset.name}
                  type="button"
                  variant="ghost"
                  className="justify-start font-normal cursor-pointer"
                  onClick={() => {
                    const newDate = preset.dates();
                    handleSelect(newDate);
                    setMonth(newDate.from);
                  }}
                >
                  {preset.name}
                </Button>
              ))}
              <Button type="button" variant="ghost" className="justify-start font-normal cursor-pointer" onClick={() => handleSelect(undefined)}>
                Clear Dates
              </Button>
            </div>
            <div>
              <div className="flex flex-col gap-2 p-2">
                <div className="flex items-center justify-start gap-2">
                  <Select
                    value={month.getMonth().toString()}
                    onValueChange={(value) =>
                      setMonth((prevMonth) => {
                        const newMonth = new Date(prevMonth);
                        newMonth.setMonth(parseInt(value));
                        return newMonth;
                      })
                    }
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue>{format(month, "MMMM")}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {months.map((month, index) => (
                        <SelectItem key={month} value={index.toString()}>
                          {month}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={month.getFullYear().toString()}
                    onValueChange={(value) =>
                      setMonth((prevMonth) => {
                        const newMonth = new Date(prevMonth);
                        newMonth.setFullYear(parseInt(value));
                        return newMonth;
                      })
                    }
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue>{format(month, "yyyy")}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" className="h-9 cursor-pointer" onClick={() => setMonth(new Date())}>
                    Today
                  </Button>
                </div>
              </div>
              <Calendar
                mode="range"
                selected={range?.from ? { from: range.from, to: range.to } : undefined}
                onSelect={handleSelect}
                month={month}
                onMonthChange={setMonth}
                numberOfMonths={2}
                disabled={disabledDays}
                defaultMonth={new Date()}
                startMonth={subYears(new Date(), 10)}
                endMonth={new Date()}
                className="p-0"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </Field>
  );
}
