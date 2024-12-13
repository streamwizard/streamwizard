import { redirect } from "next/navigation";

export default function ClipsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
  redirect("/dashboard/clips");


  return (
    <></>
  );
}
