import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui";
import { cn } from "@/lib/utils";

export interface DataColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  /**
   * Where the value goes on a phone card:
   * - "title": the card's heading (give it to one column)
   * - "badge": next to the heading (status, severity)
   * - "field": a labelled line under the heading (the default)
   * - "hidden": left out; the detail page or the desktop table has it
   */
  mobile?: "title" | "badge" | "field" | "hidden";
  /** Label on the phone card when the header isn't plain text. */
  mobileLabel?: string;
  className?: string;
  headClassName?: string;
}

interface DataListProps<T> {
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Makes the whole row (and the whole phone card) one link. */
  rowHref?: (row: T) => string | undefined;
  /** Buttons for one row: the last table column, the foot of the phone card. */
  actions?: (row: T) => React.ReactNode;
  actionsHeader?: React.ReactNode;
  rowClassName?: (row: T) => string | undefined;
  className?: string;
}

/**
 * One list, two layouts: a table from 640px up, a stack of cards below it, so
 * nothing scrolls sideways on a phone. Both are in the markup and CSS picks
 * one, which keeps this usable from server components and free of layout flash.
 * It draws no border of its own: put it in a Card (`py-0`) or a bordered box.
 */
export function DataList<T>({ columns, rows, rowKey, rowHref, actions, actionsHeader, rowClassName, className }: DataListProps<T>) {
  const titleColumn = columns.find((column) => column.mobile === "title") ?? columns[0];
  const badgeColumns = columns.filter((column) => column.mobile === "badge");
  const fieldColumns = columns.filter((column) => column !== titleColumn && (column.mobile ?? "field") === "field");

  return (
    <div className={className}>
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key} className={column.headClassName}>
                  {column.header}
                </TableHead>
              ))}
              {actions && <TableHead className="text-right">{actionsHeader ?? <span className="sr-only">Actions</span>}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const href = rowHref?.(row);
              return (
                <TableRow key={rowKey(row)} className={cn(href && "relative", rowClassName?.(row))}>
                  {columns.map((column) => (
                    <TableCell key={column.key} className={column.className}>
                      {href && column === titleColumn ? (
                        <Link href={href} className="font-medium after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/50">
                          {column.cell(row)}
                        </Link>
                      ) : (
                        column.cell(row)
                      )}
                    </TableCell>
                  ))}
                  {actions && <TableCell className="relative z-10 text-right">{actions(row)}</TableCell>}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ul className="divide-y sm:hidden">
        {rows.map((row) => {
          const href = rowHref?.(row);
          const title = titleColumn?.cell(row);
          const rowActions = actions?.(row);
          return (
            <li key={rowKey(row)} className={cn("relative px-4 py-3", rowClassName?.(row))}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 text-sm font-medium">
                  {href ? (
                    <Link href={href} className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/50">
                      {title}
                    </Link>
                  ) : (
                    title
                  )}
                </div>
                {badgeColumns.length > 0 && (
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                    {badgeColumns.map((column) => (
                      <span key={column.key}>{column.cell(row)}</span>
                    ))}
                  </div>
                )}
              </div>
              {fieldColumns.length > 0 && (
                <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
                  {fieldColumns.map((column) => (
                    <div key={column.key} className="contents">
                      <dt className="text-muted-foreground">{column.mobileLabel ?? column.header}</dt>
                      <dd className="min-w-0 break-words">{column.cell(row)}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {rowActions && <div className="relative z-10 mt-3 flex flex-wrap items-center gap-2">{rowActions}</div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
