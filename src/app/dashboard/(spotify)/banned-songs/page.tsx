
import SpotifySearchBar from '@/components/search-bars/spotify-search-bar'
import { BannedSongsColumns } from '@/components/tabels/banned-songs/banned-songs-columns'
import { BannedSongsTable } from '@/components/tabels/banned-songs/banned-songs-table'
import React from 'react'

export default function Page() {
  return (
    <div className="hidden h-full flex-1 flex-col  md:flex">
    <div className="space-y-2 ">
      <SpotifySearchBar  />
      <div className="flex items-center space-x-2">
        <BannedSongsTable columns={BannedSongsColumns} />


      </div>
    </div>
  </div>
  )
}
