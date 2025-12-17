"use client";

import React, { useEffect, useState, useRef, Dispatch, SetStateAction } from "react";
import { useDebounce } from "@uidotdev/usehooks";
import { AnimatePresence, motion } from "framer-motion";
import ClickAwayListener from "react-click-away-listener";
import Image from "next/image";
import LoadingSpinner from "../global/loading";
import { Input } from "./input";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  setResults: React.Dispatch<React.SetStateAction<unknown[]>>;
  Component: React.FC<{ setSearchTerm: Dispatch<SetStateAction<string>> }>;
  results: unknown[];
  searchFn: (searchTerm: string) => Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  DisplayValue: string;
  setDisplayValue: React.Dispatch<React.SetStateAction<string>>;
  image?: string | null;
}

export function SearchBar({
  setResults,
  Component,
  results,
  searchFn,
  placeholder = "Search here",
  disabled,
  setDisplayValue,
  DisplayValue,
  image,
}: SearchBarProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [isUpdating, setIsUpdating] = useState(true); // New state to control fetch

  const debouncedSearchTerm = useDebounce(DisplayValue, 300);
  
  // Use refs to store latest values without causing re-renders
  const searchFnRef = useRef(searchFn);
  const setResultsRef = useRef(setResults);
  const prevDebouncedTermRef = useRef<string | undefined>(undefined);
  
  // Update refs when props change
  useEffect(() => {
    searchFnRef.current = searchFn;
    setResultsRef.current = setResults;
  }, [searchFn, setResults]);

  // Effect for fetching data
  useEffect(() => {
    if (!isUpdating && debouncedSearchTerm) {
      let cancelled = false;
      
      // Defer state update to avoid synchronous setState in effect
      Promise.resolve().then(() => {
        if (!cancelled) {
          setIsSearching(true);
          searchFnRef.current(debouncedSearchTerm).finally(() => {
            if (!cancelled) {
              setIsSearching(false);
            }
          });
        }
      });
      
      return () => {
        cancelled = true;
      };
    }
  }, [debouncedSearchTerm, isUpdating]);

  // Effect for clearing results when search term becomes empty
  useEffect(() => {
    const prevTerm = prevDebouncedTermRef.current;
    prevDebouncedTermRef.current = debouncedSearchTerm;
    
    // Only clear if transitioning from non-empty to empty
    if (prevTerm && !debouncedSearchTerm) {
      setResultsRef.current([]);
    }
  }, [debouncedSearchTerm]);

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
