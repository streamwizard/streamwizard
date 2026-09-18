"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

// next-themes renders its anti-flash <script> through React. Only the copy in
// the server HTML runs; React 19.2 warns about the one it creates on the
// client. A non-JavaScript type on the client copy silences that without
// changing anything (next-themes already suppresses hydration diffs on it).
const themeScriptProps = { type: typeof window === "undefined" ? "text/javascript" : "application/json" }

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider scriptProps={themeScriptProps} {...props}>
      {children}
    </NextThemesProvider>
  )
}
