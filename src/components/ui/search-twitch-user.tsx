"use client";

import { useDebounce } from "@uidotdev/usehooks";
import { useRouter } from "next/navigation";
import * as React from "react";

import { searchChatter } from "@/actions/twitch/twitch-api";
import { ChannelSearchResult } from "@/types/API/twitch";
import { toast } from "sonner";

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandList } from "./command";
import { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CommandItem } from "cmdk";
import { Popover, PopoverContent } from "./popover";
import { PopoverTrigger } from "@radix-ui/react-popover";
import { Button } from "./button";
import { Check, ChevronsUpDown } from "lucide-react";
import { Input } from "./input";

export function SearchTwitchUser() {
  const [open, setOpen] = React.useState(false);

  const [searchTerm, setSearchTerm] = React.useState("js");
  const [results, setResults] = React.useState<ChannelSearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(true);
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const router = useRouter();

  const handleChange = (value: string) => {
    setSearchTerm(value);
  };

  const invoices = [
    {
      invoice: "INV001",
      paymentStatus: "Paid",
      totalAmount: "$250.00",
      paymentMethod: "Credit Card",
    },
    {
      invoice: "INV002",
      paymentStatus: "Pending",
      totalAmount: "$150.00",
      paymentMethod: "PayPal",
    },
    {
      invoice: "INV003",
      paymentStatus: "Unpaid",
      totalAmount: "$350.00",
      paymentMethod: "Bank Transfer",
    },
    {
      invoice: "INV004",
      paymentStatus: "Paid",
      totalAmount: "$450.00",
      paymentMethod: "Credit Card",
    },
    {
      invoice: "INV005",
      paymentStatus: "Paid",
      totalAmount: "$550.00",
      paymentMethod: "PayPal",
    },
    {
      invoice: "INV006",
      paymentStatus: "Pending",
      totalAmount: "$200.00",
      paymentMethod: "Bank Transfer",
    },
    {
      invoice: "INV007",
      paymentStatus: "Unpaid",
      totalAmount: "$300.00",
      paymentMethod: "Credit Card",
    },
  ];

  React.useEffect(() => {
    const search = async () => {
      setIsSearching(true);
      if (debouncedSearchTerm !== "" && debouncedSearchTerm.length > 2) {
        const data = await searchChatter(debouncedSearchTerm);
        if (data) {
          console.log(data);
          setResults(data);
          setIsSearching(false);
        } else {
          toast.error("Error searching for chatters.");
        }
      }
    };

    search();
  }, [debouncedSearchTerm]);

  return (
    <>
      <Input placeholder="Search for a chatter..." value={searchTerm} onChange={(e) => handleChange(e.target.value)} />
      <Popover defaultOpen modal open>
        <PopoverTrigger className=" w-full"></PopoverTrigger>

        <PopoverContent align="start" className="mt-85 w-full">
          <Table className="w-[1560px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]" />
                <TableHead className="w-[100px]">Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((channel, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">
                    <img src={channel.thumbnail_url} alt={channel.display_name} className="w-10 h-10 rounded-full" />
                  </TableCell>
                  <TableCell className="font-medium">{channel.display_name}</TableCell>
                  <TableCell>{channel.started_at}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </PopoverContent>
      </Popover>
    </>
  );
}
