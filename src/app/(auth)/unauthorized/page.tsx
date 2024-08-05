import { Button } from '@/components/ui/button'
import Link from 'next/link'
import React from 'react'

export default function page() {
  return (
    <div className="flex h-screen w-full justify-center items-center flex-col">
      <h1 className='text-4xl'>
        Looks like you are not whitelisted to access the dashboard yet. Please Join our discord server to get access.
      </h1>
      <Link href='https://discord.gg/GpQRSH4HcY' target='_blank'>
      <Button variant="outline" className='mt-8 '>
        Join Discord
      </Button>
      </Link>
    </div>
  )
}
