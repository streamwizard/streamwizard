"use client";
import { searchTwitchChannels } from "@/actions/twitch/twitch-api";
import { ChannelSearchResult } from "@/types/twitch";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { SearchBar } from "../ui/search-bar";

interface results extends ChannelSearchResult {
  exactMatch?: boolean;
}

interface Props {
  button_label?: string;
  placeholder?: string;
  disabled?: boolean;
  onSelect?: (channel: ChannelSearchResult) => void;
  value?: string;
}

export default function TwitchSearchBar({ button_label = "Select", placeholder = "Jochemwhite", disabled = false, onSelect = () => {}, value }: Props) {
  const [results, setResults] = useState<results[]>([]);
  const [displayValue, setDisplayValue] = useState("");

  useEffect(() => {
    if (!value) {
      setDisplayValue("");
    }
  }, [value]);

  const search = async (searchTerm: string) => {
    const data = await searchTwitchChannels(searchTerm, 100);
    if (data) {
      setResults(data);

      const match = data.find((channel: ChannelSearchResult) => channel.display_name.toLowerCase() === searchTerm.toLowerCase());
      if (match) {
        const newResults: results[] = data.map((channel: ChannelSearchResult) => {
          if (channel.display_name.toLowerCase() === searchTerm.toLowerCase()) {
            return { ...channel, exactMatch: true };
          }
          return channel;
        });

        newResults.sort((a, b) => {
          if (a.exactMatch) {
            return -1;
          }
          return 0;
        });

        setResults(newResults);
      }
    } else {
      toast.error("Error searching for chatters.");
    }
  };

  return (
    <SearchBar
      results={results}
      setResults={setResults}
      searchFn={search}
      disabled={disabled}
      DisplayValue={displayValue}
      setDisplayValue={setDisplayValue}
      placeholder={placeholder}
      Component={({ setSearchTerm }) => (
        <ul className="overflow-scroll h-48">
          {results.map((channel) => (
            <li key={channel.id} className="flex items-center justify-between gap-4 p-4 border-b">
              <div className="flex items-center">
                <img src={channel.thumbnail_url} className="w-8 h-8 rounded-full" />
                <span className="mx-4">{channel.display_name}</span>
                {channel.exactMatch && <span className="text-xs text-red-500">Exact Match</span>}
              </div>

              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  onSelect(channel);
                  setResults([]);
                  setSearchTerm(channel.display_name);
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
