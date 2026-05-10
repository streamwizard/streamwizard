"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useModal } from "@/providers/modal-provider";
import { useVideoPlayerStore } from "@/stores/video-dialog-store";
import { Flag, Loader2 } from "lucide-react";

interface CreateMarkerModalProps {
  /** The timestamp (formatted) where the marker will be placed */
  timestamp: string;
}

/**
 * Modal form for creating a stream marker with an optional description.
 * Uses the useModal hook from the modal-provider.
 */
export function CreateMarkerModal({ timestamp }: CreateMarkerModalProps) {
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { closeModal } = useModal();
  const createMarker = useVideoPlayerStore((s) => s.createMarker);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await createMarker(description || undefined);
      closeModal();
    } catch {
      // Error is handled by the store via toast
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-[400px] space-y-4">
      <div className="flex items-center gap-2">
        <Flag className="h-5 w-5 text-orange-500" />
        <h2 className="text-lg font-semibold">Add Stream Marker</h2>
      </div>

      <p className="text-sm text-muted-foreground">
        Create a marker at <span className="font-mono font-medium text-foreground">{timestamp}</span> in the stream.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="marker-description">Description (optional)</Label>
          <Input id="marker-description" placeholder="Why are you marking this moment?" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={140} autoFocus />
          <p className="text-xs text-muted-foreground text-right">{description.length}/140</p>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={closeModal} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} className="bg-orange-600 hover:bg-orange-700">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Flag className="mr-2 h-4 w-4" />
                Add Marker
              </>
            )}
          </Button>
        </div>
      </form>

      <p className="text-xs text-muted-foreground border-t pt-3">Note: Markers can only be added to live streams with VOD enabled.</p>
    </div>
  );
}
