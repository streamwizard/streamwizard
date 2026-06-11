import ScrollToTopButton from "@/components/buttons/scroll-to-top";
import SyncTwitchClipsButton from "@/components/buttons/sync-twitch-clips";
import { ClipsViewSelector } from "@/components/clips/clips-view-selector";
import TwitchClipSearchForm from "@/components/forms/twitch-clip-filter-form";
import { ClipDialogProvider } from "@/providers/clip-dialog-provider";
import { Suspense } from "react";

export default function layout({ children }: { children: React.ReactNode }) {
  return (
    <ClipDialogProvider>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SyncTwitchClipsButton />
        <Suspense fallback={null}>
          <ClipsViewSelector />
        </Suspense>
      </div>
      <TwitchClipSearchForm />
      {children}
      <ScrollToTopButton />
    </ClipDialogProvider>
  );
}
