import TwitchClipSearchForm from "@/components/forms/twitch-clip-filter-form";
import { Suspense } from "react";
import ClipGrid from "./_components/clip-grid";
import Loading from "./loading";

export default function ClipsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
  return (
    <>
      <TwitchClipSearchForm />

      <Suspense fallback={<Loading />} key={Math.random()}>
        <ClipGrid searchParams={searchParams} />
      </Suspense>
    </>
  );
}
