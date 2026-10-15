import { NotFoundContent } from "@/components/public/not-found/not-found-content";

// For notFound() thrown by a page inside (public), such as a blog post that
// isn't live. Without this file Next used app/not-found.tsx, which brings its
// own header and footer, inside this group's layout: two of each.
// No metadata export: here it doesn't reach the head (the root's does), so
// the page that throws sets the title itself (see contentMetadata).

export default function PublicNotFound() {
  return <NotFoundContent />;
}
