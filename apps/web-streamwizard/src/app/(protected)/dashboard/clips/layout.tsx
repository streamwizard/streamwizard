import { ClipsViewSelector } from "@/components/clips/clips-view-selector";
import TwitchClipSearchForm from "@/components/forms/twitch-clip-filter-form";
import { ClipDialogProvider } from "@/providers/clip-dialog-provider";
import { Suspense } from "react";

export default function layout({ children }: { children: React.ReactNode }) {
  return (
    <ClipDialogProvider>
      <div className="mb-4 flex justify-end">
        <Suspense fallback={null}>
          <ClipsViewSelector />
        </Suspense>
      </div>
      <TwitchClipSearchForm />
      {children}
    </ClipDialogProvider>
  );
}
