"use client"

import React from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react"
import Link from "next/link"

export type Command = {
  id: string
  channel_id: string
  trigger: string
  response: string
  permission: "everyone" | "moderator" | "broadcaster"
  cooldown_seconds: number | null
  usage_count: number | null
  shared: boolean | null
}

type SortKey = "trigger" | "permission" | "cooldown_seconds" | "usage_count" | "shared"

export function CommandsTable({
  commands,
  onDelete,
  onToggleShare,
}: {
  commands: Command[]
  onDelete: (formData: FormData) => Promise<void>
  onToggleShare: (formData: FormData) => Promise<void>
}) {
  const [search, setSearch] = React.useState("")
  const [permission, setPermission] = React.useState<"all" | Command["permission"]>("all")
  const [shared, setShared] = React.useState<"all" | "true" | "false">("all")
  const [sort, setSort] = React.useState<null | { key: SortKey; dir: "asc" | "desc" }>(null)

  const filtered = React.useMemo(() => {
    const lower = search.trim().toLowerCase()
    let list = [...commands]
    if (lower) {
      list = list.filter((c) =>
        c.trigger.toLowerCase().includes(lower) || c.response.toLowerCase().includes(lower)
      )
    }
    if (permission !== "all") {
      list = list.filter((c) => c.permission === permission)
    }
    if (shared !== "all") {
      const want = shared === "true"
      list = list.filter((c) => Boolean(c.shared) === want)
    }
    if (sort) {
      const { key, dir } = sort
      list.sort((a, b) => {
        const va = a[key]
        const vb = b[key]
        let cmp = 0
        if (key === "cooldown_seconds" || key === "usage_count") {
          const na = (va as number | null) ?? 0
          const nb = (vb as number | null) ?? 0
          cmp = na - nb
        } else if (key === "shared") {
          const ba = Boolean(va)
          const bb = Boolean(vb)
          cmp = ba === bb ? 0 : ba ? 1 : -1
        } else {
          cmp = String(va).localeCompare(String(vb))
        }
        return dir === "asc" ? cmp : -cmp
      })
    }
    return list
  }, [commands, search, permission, shared, sort])

  function toggleSort(key: SortKey) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" }
      if (prev.dir === "asc") return { key, dir: "desc" }
      return null
    })
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (!sort || sort.key !== col) return <ArrowUpDown className="h-3.5 w-3.5 inline ml-1 opacity-60" />
    return sort.dir === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5 inline ml-1" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 inline ml-1" />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 w-full sm:max-w-sm">
          <div className="relative w-full">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search trigger or response..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={permission} onValueChange={(v) => setPermission(v as any)}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Permission" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All permissions</SelectItem>
              <SelectItem value="everyone">Everyone</SelectItem>
              <SelectItem value="moderator">Moderator</SelectItem>
              <SelectItem value="broadcaster">Broadcaster</SelectItem>
            </SelectContent>
          </Select>
          <Select value={shared} onValueChange={(v) => setShared(v as any)}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Shared" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="true">Shared</SelectItem>
              <SelectItem value="false">Not shared</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <button className="font-medium" onClick={() => toggleSort("trigger")}>Trigger<SortIcon col="trigger" /></button>
            </TableHead>
            <TableHead>Response</TableHead>
            <TableHead>
              <button className="font-medium" onClick={() => toggleSort("permission")}>Permission<SortIcon col="permission" /></button>
            </TableHead>
            <TableHead>
              <button className="font-medium" onClick={() => toggleSort("cooldown_seconds")}>Cooldown<SortIcon col="cooldown_seconds" /></button>
            </TableHead>
            <TableHead>
              <button className="font-medium" onClick={() => toggleSort("usage_count")}>Usage<SortIcon col="usage_count" /></button>
            </TableHead>
            <TableHead>
              <button className="font-medium" onClick={() => toggleSort("shared")}>Shared<SortIcon col="shared" /></button>
            </TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-mono">!{c.trigger}</TableCell>
              <TableCell className="max-w-md truncate" title={c.response}>{c.response}</TableCell>
              <TableCell>{c.permission}</TableCell>
              <TableCell>{c.cooldown_seconds ?? 0}s</TableCell>
              <TableCell>{c.usage_count ?? 0}</TableCell>
              <TableCell>{c.shared ? "Yes" : "No"}</TableCell>
              <TableCell className="space-x-2">
                <Link href={`/dashboard/commands/${c.id}/edit`}><Button variant="secondary" size="sm">Edit</Button></Link>
                <form action={onToggleShare} className="inline">
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="shared" value={String(!!c.shared)} />
                  <Button type="submit" variant="outline" size="sm">{c.shared ? "Unshare" : "Share"}</Button>
                </form>
                <form action={onDelete} className="inline">
                  <input type="hidden" name="id" value={c.id} />
                  <Button type="submit" variant="destructive" size="sm">Delete</Button>
                </form>
              </TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">No commands found.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export default CommandsTable


