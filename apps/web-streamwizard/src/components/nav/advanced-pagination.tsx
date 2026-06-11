'use client'

import { useState } from 'react'
import { Button } from "@repo/ui"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

interface PaginationProps {
  totalPages: number
  initialPage?: number
}

export function AdvancedPagination({ totalPages = 100, initialPage = 1, }: PaginationProps) {
  const [currentPage, setCurrentPage] = useState(initialPage)
  const searchParams = useSearchParams()
  const pathname = usePathname()
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
    router.push(`${pathname}?${params.toString()}`)
  }


  const renderPageNumbers = () => {
    const pageNumbers = []
    const maxVisiblePages = 5
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
        <Button key={1} variant="outline" onClick={() => changePage(1)} className="h-8 w-8 sm:h-10 sm:w-10 text-xs sm:text-sm">
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
          className="h-8 w-8 sm:h-10 sm:w-10 text-xs sm:text-sm"
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
        <Button key={totalPages} variant="outline" onClick={() => changePage(totalPages)} className="h-8 w-8 sm:h-10 sm:w-10 text-xs sm:text-sm">
          {totalPages}
        </Button>
      )
    }

    return pageNumbers
  }

  return (
    <div className="flex flex-col items-center space-y-2">
      <div className="flex items-center justify-center overflow-x-auto max-w-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex items-center space-x-1 sm:space-x-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => changePage(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label="Previous page"
            className="h-8 w-8 sm:h-10 sm:w-10 shrink-0"
          >
            <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
          {renderPageNumbers()}
          <Button
            variant="outline"
            size="icon"
            onClick={() => changePage(currentPage + 1)}
            disabled={currentPage === totalPages}
            aria-label="Next page"
            className="h-8 w-8 sm:h-10 sm:w-10 shrink-0"
          >
            <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
        </div>
      </div>
      <span className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </span>
    </div>
  )
}