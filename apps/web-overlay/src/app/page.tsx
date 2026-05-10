import { notFound } from "next/navigation";

/** Overlay host only — no public homepage (open overlay URLs from the dashboard). */
export default function RootPage() {
  notFound();
}
