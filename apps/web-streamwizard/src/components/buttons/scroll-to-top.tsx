"use client";

import { cn } from "@/lib/utils";
import { Button } from "@repo/ui";
import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

const SCROLL_THRESHOLD = 400;

function getContentCenterX() {
  const main = document.querySelector('main[data-slot="sidebar-inset"]');
  if (!main) return window.innerWidth / 2;

  const rect = main.getBoundingClientRect();
  return rect.left + rect.width / 2;
}

export default function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);
  const [centerX, setCenterX] = useState<number | null>(null);

  useEffect(() => {
    const updatePosition = () => {
      setCenterX(getContentCenterX());
    };

    const onScroll = () => {
      setIsVisible(window.scrollY > SCROLL_THRESHOLD);
      updatePosition();
    };

    updatePosition();
    onScroll();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updatePosition);

    const main = document.querySelector('main[data-slot="sidebar-inset"]');
    const resizeObserver = main ? new ResizeObserver(updatePosition) : null;
    if (main && resizeObserver) resizeObserver.observe(main);

    const sidebar = document.querySelector('[data-slot="sidebar"]');
    const mutationObserver =
      sidebar &&
      new MutationObserver(updatePosition);
    if (sidebar && mutationObserver) {
      mutationObserver.observe(sidebar, { attributes: true, attributeFilter: ["data-state"] });
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updatePosition);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div
      style={{ left: centerX ?? "50%" }}
      className={cn(
        "pointer-events-none fixed bottom-8 z-50 -translate-x-1/2 transition-all duration-300",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      )}
    >
      <Button
        type="button"
        size="icon"
        aria-label="Scroll to top"
        onClick={scrollToTop}
        className={cn(
          "pointer-events-auto size-12 rounded-full border ring-2 transition-[transform,box-shadow] hover:-translate-y-1",
          "border-[#374151] !bg-[#374151] !text-white ring-white/20",
          "shadow-[0_4px_12px_rgba(55,65,81,0.4),0_0_20px_rgba(255,255,255,0.15)]",
          "hover:!bg-[#4b5563] hover:!text-white hover:shadow-[0_6px_16px_rgba(55,65,81,0.5),0_0_28px_rgba(255,255,255,0.22)]",
          "dark:border-border dark:!bg-card dark:!text-foreground dark:ring-white/15",
          "dark:shadow-[0_4px_16px_rgba(0,0,0,0.55),0_0_24px_rgba(255,255,255,0.14)]",
          "dark:hover:!bg-accent dark:hover:!text-accent-foreground dark:hover:shadow-[0_6px_20px_rgba(0,0,0,0.6),0_0_32px_rgba(255,255,255,0.2)]"
        )}
      >
        <ArrowUp className="size-5 stroke-[2.5]" />
      </Button>
    </div>
  );
}
