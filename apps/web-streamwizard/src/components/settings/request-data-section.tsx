"use client";

import { useRef, useState, useTransition } from "react";
import { requestUserData } from "@/actions/auth/request-data";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui";

export function RequestDataSection() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const anchorRef = useRef<HTMLAnchorElement>(null);

  const handleRequest = () => {
    setError(null);
    startTransition(async () => {
      const result = await requestUserData();
      if (result.error || !result.data) {
        setError(result.error ?? "Failed to retrieve your data. Please try again.");
        return;
      }

      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const anchor = anchorRef.current;
      if (anchor) {
        anchor.href = url;
        anchor.download = `streamwizard-data-${new Date().toISOString().split("T")[0]}.json`;
        anchor.click();
      }

      URL.revokeObjectURL(url);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Download my data</CardTitle>
        <CardDescription>
          Export a copy of all personal data StreamWizard holds about you — profile, preferences,
          overlays, clips, commands, and more — as a JSON file.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <a ref={anchorRef} className="hidden" aria-hidden />
        <Button onClick={handleRequest} disabled={isPending}>
          {isPending ? "Preparing download…" : "Download my data"}
        </Button>
      </CardContent>
    </Card>
  );
}
