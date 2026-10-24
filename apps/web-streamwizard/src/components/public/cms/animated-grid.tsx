"use client";

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import type { ReactNode } from "react";

/*
 * The /blog and /guides result grid, animated between filter changes. Cards
 * that stay slide to their new spot, cards that drop out fade away, cards
 * that come in fade up. The server renders the cards and passes them through,
 * so the only client code here is the motion.
 *
 * initial={false}: nothing animates on page load, only on a change.
 * reducedMotion="user" drops the slide and scale and keeps a plain fade.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

interface AnimatedGridItem {
  key: string;
  node: ReactNode;
}

export function AnimatedGrid({ items, className }: { items: AnimatedGridItem[]; className?: string }) {
  return (
    <MotionConfig reducedMotion="user">
      <ul className={className}>
        <AnimatePresence initial={false} mode="popLayout">
          {items.map((item) => (
            <motion.li
              key={item.key}
              layout="position"
              className="flex"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15, ease: "easeIn" } }}
              transition={{ duration: 0.3, ease: EASE, layout: { duration: 0.35, ease: EASE } }}
            >
              {item.node}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </MotionConfig>
  );
}
