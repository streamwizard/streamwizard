"use client";

import { useState } from "react";
import { createClipFromVod } from "@/actions/twitch/vods";
import { TwitchVideo } from "@/types/twitch";
import { toast } from "sonner";
import { Loader2, CheckCircle2, ExternalLink } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CreateClipModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  video: TwitchVideo;
}

export function CreateClipModal({ open, onOpenChange, video }: CreateClipModalProps) {
  const [title, setTitle] = useState("");
  const [offset, setOffset] = useState("0");
  const [duration, setDuration] = useState("30");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ id: string; editUrl: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const response = await createClipFromVod({
      vodId: video.id,
      title: title || undefined,
    });

    setIsLoading(false);

    if (response.success && response.data) {
      setResult(response.data);
      toast.success("Clip created successfully!");
    } else {
      toast.error(response.message);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after dialog closes
    setTimeout(() => {
      setTitle("");
      setOffset("0");
      setDuration("30");
      setResult(null);
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Clip</DialogTitle>
          <DialogDescription className="line-clamp-2">
            From: {video.title}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold text-lg">Clip Created!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your clip is ready to edit
              </p>
            </div>
            <Button asChild className="mt-2">
              <a href={result.editUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in Clip Editor
              </a>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title (optional)</Label>
              <Input
                id="title"
                placeholder="Enter clip title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="offset">VOD Offset (seconds)</Label>
              <Input
                id="offset"
                type="number"
                min="0"
                placeholder="0"
                value={offset}
                onChange={(e) => setOffset(e.target.value)}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                The position in the VOD where the clip should start
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration</Label>
              <Select value={duration} onValueChange={setDuration} disabled={isLoading}>
                <SelectTrigger id="duration">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 seconds</SelectItem>
                  <SelectItem value="10">10 seconds</SelectItem>
                  <SelectItem value="15">15 seconds</SelectItem>
                  <SelectItem value="20">20 seconds</SelectItem>
                  <SelectItem value="30">30 seconds (default)</SelectItem>
                  <SelectItem value="45">45 seconds</SelectItem>
                  <SelectItem value="60">60 seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Clip"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
