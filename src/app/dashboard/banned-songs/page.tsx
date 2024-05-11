import TwitchSearchBar from '@/components/search-bars/twitch-search-bar'
import React from 'react'

export default function Page() {
  return (
    <div className="hidden h-full flex-1 flex-col  md:flex">
    <div className="space-y-2 ">
      <TwitchSearchBar />
      <div className="flex items-center space-x-2">
        {/* <BannedChatterTable columns={BannedChatterColumns} /> */}
      </div>
    </div>
  </div>
  )
}
