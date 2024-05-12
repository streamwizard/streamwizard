"use client";
import { SearchSongs } from "@/actions/spotify/spotify-web-api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import useBannedSongs from "@/hooks/useBannedSongs";
import { TrackObjectFull } from "@/types/API/spotify-web-api";
import { useState } from "react";
import { toast } from "sonner";
import { SearchBar } from "../ui/search-bar";
import { msToTime } from "@/lib/utils";

export default function SpotifySearchBar() {
  const [results, setResults] = useState<TrackObjectFull[]>([]);

  const { banSong } = useBannedSongs();

  const handleBanSong = async (song: { chatter_id: string; chatter_name: string; song_id: string; song_name: string }) => {
    const data = banSong(song);
  };

  const search = async (searchTerm: string, offset?: number) => {
    const data = await SearchSongs({
      query: searchTerm,
      limit: 5,
      offset: 0,
    });
    if (data) {
      setResults(data.items);
    } else {
      toast.error("Error searching for Songs.");
    }
  };

  return (
    <SearchBar
      results={results}
      setResults={setResults}
      search={search}
      placeholder="Search for a song"
      Component={() => (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]" />
              <TableHead>Name</TableHead>
              <TableHead>Artists</TableHead>
              <TableHead>
                duration
              </TableHead>
              <TableHead className="w-[100px]" align="char">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((track) => (
              <TableRow key={track.id}>
                <TableCell className="font-medium">
                  <img src={track.album.images.at(0)?.url} className="w-8 h-8 rounded-full" />
                </TableCell>
                <TableCell>
                  <span>{track.name}</span>
                </TableCell>
                <TableCell>
                  <span>{track.artists.map((artist) => artist.name).join(", ")}</span>
                </TableCell>
                <TableCell>
                  <span>{msToTime(track.duration_ms)}</span>
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

