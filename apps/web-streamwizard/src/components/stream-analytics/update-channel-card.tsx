"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { toast } from "sonner";
import Image from "next/image";

import { updateChannelInfo } from "@/actions/twitch/channels";
import { LookupTwitchGame } from "@/actions/twitch/twitch-api";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from "@repo/ui";
import TwitchCategorySearch from "@/components/search-bars/twitch-category-search";

const schema = z.object({
  title: z.string().min(1, "Title is required").max(140, "Max 140 characters"),
  gameId: z.string(),
});

type FormValues = z.infer<typeof schema>;

interface UpdateChannelCardProps {
  broadcasterId: string;
  currentTitle: string | null;
  currentCategory: string | null;
  currentGameId: string | null;
}

export function UpdateChannelCard({
  broadcasterId,
  currentTitle,
  currentCategory,
  currentGameId,
}: UpdateChannelCardProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gameBoxArt, setGameBoxArt] = useState<string | null>(null);
  const [gameName, setGameName] = useState<string | null>(currentCategory);
  const router = useRouter();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: currentTitle ?? "",
      gameId: currentGameId ?? "",
    },
  });

  const watchedGameId = form.watch("gameId");

  // Fetch box art whenever the selected game changes
  useEffect(() => {
    if (!watchedGameId) {
      setGameBoxArt(null);
      return;
    }
    LookupTwitchGame(watchedGameId).then((game) => {
      if (game) {
        setGameBoxArt(game.box_art_url.replace("{width}", "52").replace("{height}", "72"));
        setGameName(game.name);
      }
    });
  }, [watchedGameId]);

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true);
    toast.promise(
      async () => {
        await updateChannelInfo(broadcasterId, {
          title: values.title,
          gameId: values.gameId || undefined,
        });
      },
      {
        loading: "Updating channel…",
        success: "Channel updated!",
        error: (err) => err?.message ?? "Failed to update channel.",
        finally() {
          setIsSubmitting(false);
          router.refresh();
        },
      }
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Update stream info</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="My awesome stream" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Category</FormLabel>
              <div className="flex items-start gap-3">
                {gameBoxArt ? (
                  <div className="shrink-0 overflow-hidden rounded-md border">
                    <Image
                      src={gameBoxArt}
                      alt={gameName ?? "Game"}
                      width={52}
                      height={72}
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-[72px] w-[52px] shrink-0 rounded-md border bg-muted" />
                )}
                <div className="flex-1">
                  <TwitchCategorySearch
                    placeholder="Search for a game or category…"
                    initalValue={currentGameId}
                    value={watchedGameId}
                    setValue={(id) => form.setValue("gameId", id)}
                    broadcasterId={broadcasterId}
                  />
                  {gameName && (
                    <p className="mt-1 text-xs text-muted-foreground">{gameName}</p>
                  )}
                </div>
              </div>
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
