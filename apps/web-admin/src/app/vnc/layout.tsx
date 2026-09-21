import { requireAdminSession } from "@/lib/admin-session";

// /vnc lives outside the (monitor) group so the popup gets a bare full-viewport
// page without the sidebar chrome — which also means it misses that layout's
// admin gate, so the same check runs here.
export default async function VncLayout({ children }: { children: React.ReactNode }) {
  await requireAdminSession();
  return children;
}
