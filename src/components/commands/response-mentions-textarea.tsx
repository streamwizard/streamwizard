"use client"

import * as React from "react"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"

type VariableDef = {
  key: string
  label: string
  description?: string
}

const DEFAULT_VARIABLES: VariableDef[] = [
  { key: "user", label: "{user}", description: "The user who invoked the command" },
  { key: "count", label: "{count}", description: "The command usage count" },
]

export type ResponseMentionsTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  variables?: VariableDef[]
}

export const ResponseMentionsTextarea = React.forwardRef<HTMLTextAreaElement, ResponseMentionsTextareaProps>(
  ({ variables = DEFAULT_VARIABLES, onChange, value, ...props }, forwardedRef) => {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null)
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [activeIndex, setActiveIndex] = React.useState(0)
  const [triggerIndex, setTriggerIndex] = React.useState<number | null>(null)
  const [lastCaret, setLastCaret] = React.useState<number | null>(null)
  const overlayRef = React.useRef<HTMLDivElement | null>(null)
  const commandInputRef = React.useRef<HTMLInputElement | null>(null)

  const list = React.useMemo(() => {
    const q = query.toLowerCase()
    return variables.filter(v => v.key.toLowerCase().includes(q) || v.label.toLowerCase().includes(q))
  }, [variables, query])

  React.useEffect(() => {
    if (activeIndex >= list.length) setActiveIndex(0)
  }, [list.length, activeIndex])

  function closeMenu() {
    setOpen(false)
    setQuery("")
    setTriggerIndex(null)
  }

  function setTextareaEl(el: HTMLTextAreaElement | null) {
    textareaRef.current = el
    if (typeof forwardedRef === 'function') forwardedRef(el)
    else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el
  }

  function insertVariable(v: VariableDef) {
    const el = textareaRef.current
    if (!el) return
    const currentValue = String(value ?? "")
    const caret = (el.selectionStart ?? lastCaret ?? currentValue.length)
    const startIdx = triggerIndex ?? caret
    const before = currentValue.slice(0, startIdx)
    const after = currentValue.slice(caret)
    const insertion = `{${v.key}}`
    const next = `${before}${insertion}${after}`
    onChange?.(next as any)
    requestAnimationFrame(() => {
      el.focus()
      const pos = before.length + insertion.length
      el.setSelectionRange(pos, pos)
    })
    closeMenu()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "@") {
      const el = e.currentTarget
      const idx = (el.selectionStart ?? 1) - 1
      setTriggerIndex(idx)
      setLastCaret(el.selectionStart ?? null)
      setTimeout(() => {
        setOpen(true)
        setQuery("")
        setActiveIndex(0)
        // focus search input after popover opens
        requestAnimationFrame(() => {
          commandInputRef.current?.focus()
        })
      }, 10)
      return
    }
    if (open) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        if (list.length > 0) setActiveIndex((i) => (i + 1) % list.length)
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        if (list.length > 0) setActiveIndex((i) => (i - 1 + list.length) % list.length)
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        closeMenu()
        return
      }
      if (e.key === "Enter" || e.key === "Tab") {
        if (list.length > 0) {
          e.preventDefault()
          insertVariable(list[activeIndex])
        }
        return
      }
    }
  }


  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    onChange?.(e.target.value as any)
    if (!open) return
    const el = textareaRef.current
    if (!el) return
    const caret = el.selectionStart ?? 0
    setLastCaret(caret)
    const currentValue = String(e.target.value)
    const trig = triggerIndex
    if (trig == null || trig < 0 || trig >= currentValue.length) {
      closeMenu()
      return
    }
    if (currentValue.charAt(trig) !== "@") {
      closeMenu()
      return
    }
    const token = currentValue.slice(trig + 1, caret)
    if (/\s|[{}/]/.test(token)) {
      closeMenu()
      return
    }
    setQuery(token)
    setActiveIndex(0)
  }

  return (
    <div className="relative">
      <Popover open={open}>
        <Textarea
          {...props}
          ref={setTextareaEl}
          value={value as any}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />
        <PopoverAnchor className="absolute left-2 bottom-2" />
        <PopoverContent
          align="start"
          sideOffset={8}
          className="p-0 w-[280px]"
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            commandInputRef.current?.focus()
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault()
            textareaRef.current?.focus()
          }}
          ref={overlayRef as any}
        >
          <Command shouldFilter={false}>
            <CommandInput ref={commandInputRef as any} placeholder="Search variables..." value={query} onValueChange={(val) => {
              setQuery(val)
              setActiveIndex(0)
            }} />
            <CommandList>
              <CommandEmpty>No variables found.</CommandEmpty>
              <CommandGroup heading="Variables">
                {list.map((v, i) => (
                  <CommandItem
                    key={v.key}
                    value={v.key}
                    onSelect={() => insertVariable(v)}
                    data-selected={i === activeIndex ? true : undefined}
                    className={i === activeIndex ? "bg-accent text-accent-foreground" : ""}
                  >
                    <span className="font-mono text-xs">{v.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{v.description}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
})

ResponseMentionsTextarea.displayName = 'ResponseMentionsTextarea'

export default ResponseMentionsTextarea


