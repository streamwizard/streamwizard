"use client"

import * as React from "react"

// Radix modals (Dialog, Drawer) set `pointer-events: none` on <body> and treat
// any click outside their content as outside. A Base UI popup portaled to
// <body> then can't be clicked. Modal content hands its own element down
// here, and Base UI popups portal into it instead.
export const PortalContainerContext = React.createContext<HTMLElement | null>(null)

/** State + callback ref for a modal's content element, merged with the caller's ref. */
export function usePortalContainer<T extends HTMLElement>(ref?: React.Ref<T>) {
  const [container, setContainer] = React.useState<T | null>(null)
  const setRef = React.useCallback(
    (node: T | null) => {
      setContainer(node)
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
    },
    [ref]
  )
  return [container, setRef] as const
}
