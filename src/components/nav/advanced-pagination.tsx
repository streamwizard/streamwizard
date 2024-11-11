'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useRouter, useSearchParams } from 'next/navigation'

interface PaginationProps {
  totalPages: number
  initialPage?: number
}

export function AdvancedPagination({ totalPages = 100, initialPage = 1, }: PaginationProps) {
  const [currentPage, setCurrentPage] = useState(initialPage)
  const params = useSearchParams()
  const searchParams = useSearchParams()
  const router = useRouter()

  const changePage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
      updatePage(page)
    }
  }

  const updatePage = (newPage: number) => {
    // Create a new URLSearchParams object from existing params
    const params = new URLSearchParams(searchParams)
    
    // Update only the page parameter
    params.set('page', newPage.toString())
    
    // Push the new URL with updated page, keeping other params intact
    router.push(`/dashboard/clips?${params.toString()}`)
  }


  const renderPageNumbers = () => {
    const pageNumbers = []
    const maxVisiblePages = 10
    let startPage, endPage

    if (totalPages <= maxVisiblePages) {
      startPage = 1
      endPage = totalPages
    } else {
      const middlePage = Math.floor(maxVisiblePages / 2)
      if (currentPage <= middlePage) {
        startPage = 1
        endPage = maxVisiblePages
      } else if (currentPage + middlePage >= totalPages) {
        startPage = totalPages - maxVisiblePages + 1
        endPage = totalPages
      } else {
        startPage = currentPage - middlePage
        endPage = currentPage + middlePage
      }
    }

    if (startPage > 1) {
      pageNumbers.push(
        <Button key={1} variant="outline" onClick={() => changePage(1)} className="w-10 h-10">
          1
        </Button>
      )
      if (startPage > 2) {
        pageNumbers.push(<span key="ellipsis1" className="px-2">...</span>)
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(
        <Button
          key={i}
          variant={i === currentPage ? "default" : "outline"}
          onClick={() => changePage(i)}
          className="w-10 h-10"
        >
          {i}
        </Button>
      )
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pageNumbers.push(<span key="ellipsis2" className="px-2">...</span>)
      }
      pageNumbers.push(
        <Button key={totalPages} variant="outline" onClick={() => changePage(totalPages)} className="w-10 h-10">
          {totalPages}
        </Button>
      )
    }

    return pageNumbers
  }

  return (
    <div className="flex flex-col items-center space-y-2">
      <div className="flex items-center justify-center space-x-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => changePage(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {renderPageNumbers()}
        <Button
          variant="outline"
          size="icon"
          onClick={() => changePage(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <span className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </span>
    </div>
  )
}