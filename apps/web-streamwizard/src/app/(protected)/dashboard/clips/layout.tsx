import TwitchClipSearchForm from "@/components/forms/twitch-clip-filter-form";

export default function layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TwitchClipSearchForm />
      {children}
    </>
  );
}
