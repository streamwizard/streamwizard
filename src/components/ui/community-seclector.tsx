'use client'

import { useState } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

//TODO: replace this with real data
const communities = [
  {
    name: 'Community 1',
    icon: '/icons/community-1.svg',
  },
  {
    name: 'Community 2',
    icon: '/icons/community-2.svg',
  },
  {
    name: 'Community 3',
    icon: '/icons/community-3.svg',
  },
  {
    name: 'Community 4',
    icon: '/icons/community-4.svg',
  },
]

export function CommunitySelector() {
  const [community, setcommunity] = useState(communities[0])
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          className="w-48 justify-between truncate"
          aria-expanded={open}
          variant="outline"
          role="combobox"
        >
          {community && value ? (
            <div className="flex flex-row items-center gap-1.5 truncate">
              <Avatar className="h-5 w-5 border border-border">
                <AvatarImage
                  src={community?.icon ?? ''}
                  alt={community?.name ?? ''}
                />
                <AvatarFallback>{community?.name.at(0) ?? ''}</AvatarFallback>
              </Avatar>
              <p className="truncate">
                {community?.name ?? 'Select framework...'}
              </p>
            </div>
          ) : (
            <p className="truncate text-muted-foreground">Select community...</p>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0">
        <Command>
          <CommandInput placeholder="Search communities..." />
          <CommandEmpty>No community found.</CommandEmpty>
          <CommandGroup>
            {communities.map((community) => (
              <CommandItem
                key={community.name}
                value={community.name}
                onSelect={(currentValue) => {
                  setValue(currentValue === value ? '' : currentValue)
                  setcommunity(community)
                  setOpen(false)
                }}
                className="flex flex-row justify-between"
              >
                <div className="flex flex-row items-center gap-1.5 truncate">
                  <Avatar className="h-4 w-4 border border-border">
                    <AvatarImage src={community.icon} alt={community.name} />
                    <AvatarFallback>{community.name.at(0)}</AvatarFallback>
                  </Avatar>
                  <p className="truncate">{community.name}</p>
                </div>
                <Check
                  className={cn(
                    'ml-2 h-4 w-4',
                    value === community.name ? 'opacity-100' : 'opacity-0'
                  )}
                />
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}