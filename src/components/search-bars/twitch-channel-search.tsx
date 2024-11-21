"use client";
import { searchTwitchChannels, LookupTwitchUser } from "@/actions/twitch/twitch-api";
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
  initalValue?: string;
}

export default function TwitchSearchBar({
  button_label = "Select",
  placeholder = "Jochemwhite",
  disabled = false,
  onSelect = () => {},
  value,
  initalValue,
}: Props) {
  const [results, setResults] = useState<results[]>([]);
  const [displayValue, setDisplayValue] = useState("");
  const [image, setImage] = useState<string | null>("");

  useEffect(() => {
    if (!value) {
      setDisplayValue("");
      setImage(null);
    }
  }, [value]);

  // if we have a initial value, look up the channel
  useEffect(() => {
    const lookup = async () => {
      if (initalValue) {
        const data = await LookupTwitchUser(initalValue);
        if (data) {
          setDisplayValue(data.display_name);
          setImage(data.profile_image_url);
        }
      }
    };
    lookup();
  }, [initalValue]);

  const search = async (searchTerm: string) => {
    if (!searchTerm) {
      setResults([]);
      setDisplayValue("");
      return;
    }
  
    const data = await searchTwitchChannels(searchTerm, 10);
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
          if (a.exactMatch && !b.exactMatch) {
            return -1;
          }
          if (!a.exactMatch && b.exactMatch) {
            return 1;
          }
          return 0;
        });
  
        console.log(newResults)
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
      image={image}
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
                  setImage(channel.thumbnail_url);
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
