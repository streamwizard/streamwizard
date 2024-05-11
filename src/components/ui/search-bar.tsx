"use client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useDebounce } from "@uidotdev/usehooks";
import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useState } from "react";
import ClickAwayListener from "react-click-away-listener";
import LoadingSpinner from "../global/loading";
import { Input } from "./input";

interface Props {
  setResults: React.Dispatch<React.SetStateAction<any[]>>;
  results: any[];
  Component: React.FC;
  search: (searchTerm: string) => Promise<void>;
  placeholder?: string;
}

export function SearchBar({ setResults, Component, results, search, placeholder }: Props) {
  const [isSearching, setIsSearching] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const fetchData = async () => {
    setIsSearching(true);
    await search(debouncedSearchTerm);
    setIsSearching(false);
  };

  useEffect(() => {
    if (debouncedSearchTerm !== "" && debouncedSearchTerm.length > 2) {
      fetchData();
    } else {
      setResults([]);
    }
  }, [debouncedSearchTerm]);

  const handleChange = (value: string) => {
    setSearchTerm(value);
  };

  const handleClickAway = () => {
    setResults([]);
    setSearchTerm("");
  };

  return (
    <Card className="w-full relative  ">
      <CardHeader className="relative">
        <Input id="name" placeholder={placeholder ? placeholder : "Search here "} onChange={(e) => handleChange(e.target.value)} value={searchTerm} />
        <span className="absolute right-8 w-6 h-6 mx-auto mt-1">{isSearching && <LoadingSpinner />}</span>
      </CardHeader>

      <AnimatePresence mode="wait">
        {results && results.length > 0 && (
          <ClickAwayListener onClickAway={handleClickAway}>
            <CardContent className="overflow-hidden absolute w-full !p-0  z-50">
              <motion.div
                initial={{ y: -400, opacity: 1 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -400, opacity: 1 }}
                transition={{ type: "just", duration: 0.2 }}
                className=" w-full border rounded mt-4 bg-[#0D0D0D]"
              >
                <Component />
              </motion.div>
            </CardContent>
          </ClickAwayListener>
        )}
      </AnimatePresence>
    </Card>
  );
}
