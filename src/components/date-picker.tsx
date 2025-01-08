"use client";

import { format, startOfDay, startOfMonth, startOfWeek, startOfYear, subDays, subMonths, subWeeks, subYears } from "date-fns";
import { CalendarIcon } from "lucide-react";
import * as React from "react";
import { useFormContext } from "react-hook-form";

import { FormValues } from "@/components/forms/twitch-clip-filter-form";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface DatePickerWithPresetsProps {
  name: string;
  label?: string;
  description?: string;
}

export function DatePickerWithPresets({ name, label, description }: DatePickerWithPresetsProps) {
  const { control } = useFormContext<FormValues>();
  const [month, setMonth] = React.useState<Date>(new Date());

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
    <FormField
      control={control}
      name="date"
      render={({ field }) => (
        <FormItem className="flex flex-col">
          {label && <FormLabel htmlFor={name}>{label}</FormLabel>}
          <Popover>
            <PopoverTrigger asChild>
              <FormControl>
                <Button
                  id={name}
                  variant={"outline"}
                  className={cn("w-full justify-start text-left font-normal", field.value?.from === undefined && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {field.value && field.value.from && field.value.to
                    ? `${format(field.value.from, "MMM d, yyyy")} - ${format(field.value.to, "MMM d, yyyy")}`
                    : "Select Date Range"}
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="center">
              <div className="flex">
                <div className="flex flex-col space-y-2 p-2 border-r m">
                  {presets.map((preset) => (
                    <Button
                      key={preset.name}
                      variant="ghost"
                      className="justify-start font-normal"
                      onClick={() => {
                        const newDate = preset.dates();
                        field.onChange(newDate);
                        setMonth(newDate.from);
                      }}
                    >
                      {preset.name}
                    </Button>
                  ))}
                  <Button variant="ghost" className="justify-start font-normal" onClick={() => field.onChange(undefined)}>
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
                      <Button variant="outline" className="h-9" onClick={() => setMonth(new Date())}>
                        Today
                      </Button>
                    </div>
                  </div>
                  <Calendar
                    mode="range"
                    selected={field.value}
                    onSelect={field.onChange}
                    month={month}
                    onMonthChange={setMonth}
                    numberOfMonths={2}
                    disabled={disabledDays}
                    defaultMonth={new Date()}
                    fromDate={subYears(new Date(), 10)}
                    toDate={new Date()}
                    className="p-0"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
