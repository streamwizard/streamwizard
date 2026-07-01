import { redirect } from "next/navigation";

export default function IrlIngestRedirectPage() {
  redirect("/dashboard/irl/obs");
}
