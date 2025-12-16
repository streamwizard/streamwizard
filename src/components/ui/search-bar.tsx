"use client";

import React, { useEffect, useState, useCallback, Dispatch, SetStateAction } from "react";
import { useDebounce } from "@uidotdev/usehooks";
import { AnimatePresence, motion } from "framer-motion";
import ClickAwayListener from "react-click-away-listener";
import Image from "next/image";
import LoadingSpinner from "../global/loading";
import { Input } from "./input";
import { cn } from "@/lib/utils";

interface SearchBarProps<T = unknown> {
  setResults: React.Dispatch<React.SetStateAction<T[]>>;
  Component: React.FC<{ setSearchTerm: Dispatch<SetStateAction<string>> }>;
  results: T[];
  searchFn: (searchTerm: string) => Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  DisplayValue: string;
  setDisplayValue: React.Dispatch<React.SetStateAction<string>>;
  image?: string | null;
}

export function SearchBar<T = unknown>({
  setResults,
  Component,
  results,
  searchFn,
  placeholder = "Search here",
  disabled,
  setDisplayValue,
  DisplayValue,
  image,
}: SearchBarProps<T>) {
  const [isSearching, setIsSearching] = useState(false);
  const [isUpdating, setIsUpdating] = useState(true); // New state to control fetch

  const debouncedSearchTerm = useDebounce(DisplayValue, 300);

  const fetchData = useCallback(async () => {
    if (isUpdating) return; // Skip fetch if updating input from item click

    setIsSearching(true);
    await searchFn(debouncedSearchTerm);
    setIsSearching(false);
  }, [isUpdating, debouncedSearchTerm, searchFn]);

  useEffect(() => {
    if (!isUpdating && debouncedSearchTerm) {
      // Defer state updates to avoid synchronous setState in effect
      Promise.resolve().then(() => {
        fetchData();
      });
    } else if (!debouncedSearchTerm) {
      setResults([]);
    }
  }, [debouncedSearchTerm, isUpdating, fetchData, setResults]);

  const handleChange = (value: string) => {
    setIsUpdating(false);
    setDisplayValue(value);
  };

  const handleClickAway = () => {
    setResults([]);
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        {image && <Image src={image} alt="" width={24} height={24} className="absolute top-1.5 left-2 h-6 w-6 rounded-full" />}
        <Input
          id="name"
          disabled={disabled}
          className={cn("transition-all ", image && "pl-10")}
          placeholder={placeholder}
          onChange={(e) => handleChange(e.target.value)}
          value={DisplayValue}
        />
        {isSearching && (
          <span className="absolute top-[2px] right-8 w-6 h-6 mx-auto mt-1">
            <LoadingSpinner />
          </span>
        )}
      </div>
      <AnimatePresence>
        {results.length > 0 && (
          <ClickAwayListener onClickAway={handleClickAway}>
            <>
              <div className="absolute z-50 w-full overflow-hidden p-0!">
                <motion.div
                  initial={{ y: -400, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -400, opacity: 0 }}
                  transition={{ type: "spring", duration: 0.2 }}
                  className="w-full mt-4 bg-[#0D0D0D] border rounded"
                >
                  <Component
                    setSearchTerm={(value) => {
                      setIsUpdating(true); // Set isUpdating to skip fetching
                      setDisplayValue(value); // Update input value without triggering fetch
                      setResults([]); // Clear results after selection
                    }}
                  />
                </motion.div>
              </div>
            </>
          </ClickAwayListener>
        )}
      </AnimatePresence>
    </div>
  );
}
