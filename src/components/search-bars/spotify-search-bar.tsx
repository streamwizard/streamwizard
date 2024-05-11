"use client";
import React, { useEffect, useState } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChannelSearchResult } from "@/types/API/twitch";
import { Button } from "../ui/button";
import TwitchCard from "../hover-cards/twitch-card";
import useBannedChatters from "@/hooks/useBannedChatter";
import { useDebounce } from "@uidotdev/usehooks";
import { toast } from "sonner";
import { searchChatter } from "@/actions/twitch/twitch-api";
import { SearchBar } from "../ui/search-bar";
import useBannedSongs from "@/hooks/useBannedSongs";

interface results extends ChannelSearchResult {
  exactMatch?: boolean;
}

export default function TwitchSearchBar() {
  const [results, setResults] = useState<results[]>([]);

  const { banSong } = useBannedSongs();

  const handleBanChatter = async (song: { chatter_id: string; chatter_name: string; song_id: string; song_name: string }) => {
    const data = banSong(song);
  };

  const search = async (searchTerm: string) => {
    const data = await searchChatter(searchTerm, 5);
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
      search={search}
      placeholder="Search for a chatter"
      Component={() => (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]" />
              <TableHead>Name</TableHead>
              <TableHead className="w-[100px]" align="char">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((channel) => (
              <TableRow key={channel.id}>
                <TableCell className="font-medium">
                  <img src={channel.thumbnail_url} className="w-8 h-8 rounded-full" />
                </TableCell>
                <TableCell>
                  <HoverCard>
                    <HoverCardTrigger asChild>
                      <Button variant="ghost">{channel.display_name}</Button>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-80">
                      <TwitchCard broadcaster_id={channel.id} />
                    </HoverCardContent>
                  </HoverCard>
                  {channel.exactMatch && <span className="text-xs text-red-500">Exact Match</span>}
                </TableCell>
                <TableCell>
                  {/* <Button
                    variant="destructive"
                    onClick={() => {
                      handleBanChatter({
                        chatter_id: channel.id,
                        chatter_name: channel.display_name,
                      });
                    }}
                  >
                    Ban Chatter
                  </Button> */}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    />
  );
}
