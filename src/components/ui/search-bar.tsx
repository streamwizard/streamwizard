"use client";

import React, { useEffect, useState, Dispatch, SetStateAction } from "react";
import { useDebounce } from "@uidotdev/usehooks";
import { AnimatePresence, motion } from "framer-motion";
import ClickAwayListener from "react-click-away-listener";
import LoadingSpinner from "../global/loading";
import { Input } from "./input";

interface SearchBarProps {
  setResults: React.Dispatch<React.SetStateAction<any[]>>;
  Component: React.FC<{ setSearchTerm: Dispatch<SetStateAction<string>> }>;
  results: any[];
  searchFn: (searchTerm: string) => Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  DisplayValue: string;
  setDisplayValue:  React.Dispatch<React.SetStateAction<string>>
}

export function SearchBar({
  setResults,
  Component,
  results,
  searchFn,
  placeholder = "Search here",
  disabled,
  setDisplayValue,
  DisplayValue

}: SearchBarProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false); // New state to control fetch

  const debouncedSearchTerm = useDebounce(DisplayValue, 300);

  const fetchData = async () => {
    if (isUpdating) return; // Skip fetch if updating input from item click

    setIsSearching(true);
    await searchFn(debouncedSearchTerm);
    setIsSearching(false);
  };

  useEffect(() => {
    
    
    if (!isUpdating && debouncedSearchTerm && debouncedSearchTerm.length > 3) {
      console.log("debouncedSearchTerm", debouncedSearchTerm);
      fetchData();
    } else if (!debouncedSearchTerm) {
      setResults([]);
    }

    // Reset isUpdating after searchTerm updates
    setIsUpdating(false);
  }, [debouncedSearchTerm]);

  const handleChange = (value: string) => {
    setDisplayValue(value);
  };

  const handleClickAway = () => {
    setResults([]);
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <Input
          id="name"
          disabled={disabled}
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
            <div className="absolute z-50 w-full overflow-hidden !p-0">
              <motion.div
                initial={{ y: -400, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -400, opacity: 0 }}
                transition={{ type: "just", duration: 0.2 }}
                className="w-full mt-4 bg-[#0D0D0D] border rounded"
              >
                <Component setSearchTerm={(value) => {
                  setIsUpdating(true); // Set isUpdating to skip fetching
                  setDisplayValue(value); // Update input value without triggering fetch
                  setResults([]); // Clear results after selection
                }} />
              </motion.div>
            </div>
          </ClickAwayListener>
        )}
      </AnimatePresence>
    </div>
  );
}
