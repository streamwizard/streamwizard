import ScrollToTopButton from "@/components/buttons/scroll-to-top";
import SyncTwitchClipsButton from "@/components/buttons/sync-twitch-clips";
import TwitchClipSearchForm from "@/components/forms/twitch-clip-filter-form";

export default function layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mb-4 flex justify-start">
        <SyncTwitchClipsButton />
      </div>
      <TwitchClipSearchForm />
      {children}
      <ScrollToTopButton />
    </>
  );
}
