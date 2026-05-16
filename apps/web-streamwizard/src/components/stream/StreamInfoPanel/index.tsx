"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useTransition } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@repo/ui";
import { updateChannelInfo } from "@/actions/twitch/channels";
import { LookupTwitchGame } from "@/actions/twitch/twitch-api";
import TwitchCategorySearch from "@/components/search-bars/twitch-category-search";

interface StreamInfoPanelProps {
  broadcasterId: string;
  currentTitle: string | null;
  currentCategory: string | null;
  currentGameId: string | null;
}

export function StreamInfoPanel({
  broadcasterId,
  currentTitle,
  currentCategory,
  currentGameId,
}: StreamInfoPanelProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(currentTitle ?? "");
  const [gameId, setGameId] = useState(currentGameId ?? "");
  const [gameName, setGameName] = useState(currentCategory ?? "");
  const [gameBoxArt, setGameBoxArt] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!gameId) {
      setGameBoxArt(null);
      return;
    }
    LookupTwitchGame(gameId).then((game) => {
      if (game) {
        setGameBoxArt(game.box_art_url.replace("{width}", "52").replace("{height}", "72"));
        setGameName(game.name);
      }
    });
  }, [gameId]);

  function handleCancel() {
    setTitle(currentTitle ?? "");
    setGameId(currentGameId ?? "");
    setGameName(currentCategory ?? "");
    setEditing(false);
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await updateChannelInfo(broadcasterId, {
          title: title || undefined,
          gameId: gameId || undefined,
        });
        toast.success("Channel updated!");
        setEditing(false);
        router.refresh();
      } catch {
        toast.error("Failed to update channel.");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Stream info</CardTitle>
          {!editing && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => setEditing(true)}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My awesome stream"
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <div className="flex items-start gap-2">
                {gameBoxArt ? (
                  <div className="shrink-0 overflow-hidden rounded border">
                    <Image src={gameBoxArt} alt={gameName} width={40} height={56} className="object-cover" />
                  </div>
                ) : (
                  <div className="h-14 w-10 shrink-0 rounded border bg-muted" />
                )}
                <div className="flex-1">
                  <TwitchCategorySearch
                    placeholder="Search categories…"
                    initalValue={currentGameId}
                    value={gameId}
                    setValue={setGameId}
                    broadcasterId={broadcasterId}
                  />
                  {gameName && (
                    <p className="mt-1 text-xs text-muted-foreground">{gameName}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={handleSave} disabled={isPending}>
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                <span className="ml-1">{isPending ? "Saving…" : "Save"}</span>
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancel} disabled={isPending}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Title</p>
              <p className="mt-0.5 text-sm font-medium leading-snug line-clamp-2">
                {currentTitle ?? "No title set"}
              </p>
            </div>
            {currentCategory && (
              <div>
                <p className="text-xs text-muted-foreground">Category</p>
                <p className="mt-0.5 text-sm">{currentCategory}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
