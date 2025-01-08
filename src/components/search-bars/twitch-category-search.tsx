"use client";

import React, { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { SearchBar } from "../ui/search-bar";
import { useSession } from "@/providers/session-provider";
import { LookupTwitchGame, searchTwitchCategories } from "@/actions/twitch/twitch-api";
import { TwitchCategory } from "@/types/twitch";
import { toast } from "sonner";

// Define SearchResult as a type extending TwitchCategory with an optional exactMatch
type SearchResult = TwitchCategory & { exactMatch?: boolean };

interface TwitchCategorySearchProps {
  button_label?: string;
  placeholder?: string;
  disabled?: boolean;
  setValue: (game_id: string) => void;
  value?: string;
  initalValue?: string | null;
}

export default function TwitchCategorySearch({
  button_label = "Select",
  placeholder = "Rocket League",
  disabled = false,
  setValue,
  value = "",
  initalValue,
}: TwitchCategorySearchProps) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [displayValue, setDisplayValue] = useState("");
  const { user_metadata } = useSession();

  useEffect(() => {
    if (!value) {
      setDisplayValue("");
    }
  }, [value]);

  useEffect(() => {
    const fetchInitialGame = async () => {
      if (initalValue) {
        const res = await LookupTwitchGame(initalValue);
        if (res) {
          setDisplayValue(res.name);
        }
      }
    };

    fetchInitialGame();
  }, [initalValue]);

  const search = async (searchTerm: string) => {
    try {
      const data = await searchTwitchCategories(user_metadata.sub, searchTerm);
      if (data) {
        const match = data.find((category) => category.name.toLowerCase() === searchTerm.toLowerCase());
        const newResults: SearchResult[] = data.map((category) =>
          match && category.name.toLowerCase() === searchTerm.toLowerCase() ? { ...category, exactMatch: true } : category
        );

        setResults(newResults.sort((a, b) => (a.exactMatch ? -1 : 0)));
      }
    } catch {
      toast.error("Error searching for categories.");
    }
  };

  return (
    <SearchBar
      results={results}
      setResults={setResults}
      searchFn={search}
      disabled={disabled}
      placeholder={placeholder}
      DisplayValue={displayValue}
      setDisplayValue={setDisplayValue}
      Component={({ setSearchTerm }) => (
        <ul className="overflow-scroll h-48">
          {results.map((category) => (
            <li key={category.id} className="flex items-center justify-between gap-4 p-4 border-b">
              <div className="flex items-center">
                <img src={category.box_art_url} className="w-8 h-8 rounded-full" alt={category.name} />
                <span className="mx-4">{category.name}</span>
                {category.exactMatch && <span className="text-xs text-red-500">Exact Match</span>}
              </div>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setValue(category.id);
                  setSearchTerm(category.name);
                  setDisplayValue(category.name);
                  setResults([]);
                }}
              >
                {button_label}
              </Button>
            </li>
          ))}
        </ul>
      )}
    />
  );
}
