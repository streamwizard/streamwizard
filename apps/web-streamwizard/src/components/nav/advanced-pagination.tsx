'use client'

import { useEffect, useState } from 'react'
import { Button } from "@repo/ui"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

interface PaginationProps {
  totalPages: number
  initialPage?: number
}

export function AdvancedPagination({ totalPages = 100, initialPage = 1, }: PaginationProps) {
  const safeTotalPages = Math.max(1, totalPages)
  const [currentPage, setCurrentPage] = useState(initialPage)
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    setCurrentPage(initialPage)
  }, [initialPage])

  const changePage = (page: number) => {
    if (page >= 1 && page <= safeTotalPages) {
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
    const maxVisiblePages = 4
    let startPage, endPage

    if (safeTotalPages <= maxVisiblePages) {
      startPage = 1
      endPage = safeTotalPages
    } else {
      const middlePage = Math.floor(maxVisiblePages / 2)
      if (currentPage <= middlePage) {
        startPage = 1
        endPage = maxVisiblePages
      } else if (currentPage + middlePage >= safeTotalPages) {
        startPage = safeTotalPages - maxVisiblePages + 1
        endPage = safeTotalPages
      } else {
        startPage = currentPage - middlePage
        endPage = currentPage + middlePage
      }
    }

    if (startPage > 1) {
      pageNumbers.push(
        <Button key={1} variant="outline" size="sm" onClick={() => changePage(1)} className="h-8 min-w-8 px-2 text-xs">
          1
        </Button>
      )
      if (startPage > 2) {
        pageNumbers.push(<span key="ellipsis1" className="px-1 text-xs text-muted-foreground">...</span>)
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(
        <Button
          key={i}
          variant={i === currentPage ? "default" : "outline"}
          onClick={() => changePage(i)}
          size="sm"
          className="h-8 min-w-8 px-2 text-xs"
        >
          {i}
        </Button>
      )
    }

    if (endPage < safeTotalPages) {
      if (endPage < safeTotalPages - 1) {
        pageNumbers.push(<span key="ellipsis2" className="px-1 text-xs text-muted-foreground">...</span>)
      }
      pageNumbers.push(
        <Button key={safeTotalPages} variant="outline" size="sm" onClick={() => changePage(safeTotalPages)} className="h-8 min-w-8 px-2 text-xs">
          {safeTotalPages}
        </Button>
      )
    }

    return pageNumbers
  }

  return (
    <div className="flex items-center justify-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => changePage(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-3.5" />
        </Button>
        {renderPageNumbers()}
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => changePage(currentPage + 1)}
          disabled={currentPage === safeTotalPages}
          aria-label="Next page"
        >
          <ChevronRight className="size-3.5" />
        </Button>
    </div>
  )
}