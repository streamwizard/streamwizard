"use client";

import { useEffect, useState } from "react";
import { Button } from "@repo/ui";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScrollToTopProps {
  threshold?: number;
  className?: string;
}

export function ScrollToTop({ threshold = 300, className }: ScrollToTopProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  if (!visible) return null;

  return (
    <Button
      size="icon"
      variant="outline"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={cn("fixed bottom-6 right-6 z-50 rounded-full shadow-md", className)}
      aria-label="Scroll to top"
    >
      <ArrowUp className="h-4 w-4" />
    </Button>
  );
}
