"use client";

import Link from "next/link";
import { MonitorSmartphone } from "lucide-react";
import { Button, Card, CardContent } from "@repo/ui";
import { useWideScreen } from "@/hooks/use-wide-screen";

interface DesktopOnlyProps {
  /** What the tool is called, as the start of a sentence: "The live feed". */
  tool: string;
  /** The phone-friendly place to go instead. */
  backHref?: string;
  backLabel?: string;
  /** Skip the card around the notice: for a tool that already sits inside one. */
  bare?: boolean;
  children: React.ReactNode;
}

/**
 * For the few tools that need a pointer and room: the message builder, the
 * topology graph, the live feed, VNC. Below 768px it shows a short notice
 * instead. The tool isn't mounted there at all, so it opens no socket in the
 * background; the notice itself is plain CSS, so it never flashes on a desktop.
 */
export function DesktopOnly({ tool, backHref, backLabel, bare = false, children }: DesktopOnlyProps) {
  const wide = useWideScreen();

  const notice = (
    <div className="flex flex-col items-start gap-3">
      <MonitorSmartphone className="size-6 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">{tool} needs a larger screen</p>
        <p className="text-sm text-muted-foreground">
          Open it on a tablet or a computer. The pages around it work on your phone.
        </p>
      </div>
      {backHref && (
        <Button variant="outline" className="h-10" asChild>
          <Link href={backHref}>{backLabel ?? "Go back"}</Link>
        </Button>
      )}
    </div>
  );

  return (
    <>
      {bare ? (
        <div className="md:hidden">{notice}</div>
      ) : (
        <Card className="md:hidden">
          <CardContent>{notice}</CardContent>
        </Card>
      )}
      {wide && children}
    </>
  );
}
