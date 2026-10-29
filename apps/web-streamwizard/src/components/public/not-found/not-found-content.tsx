import { Button } from "@repo/ui";
import { TrackedLink } from "@/components/public/analytics/tracked-link";
import { docsLink } from "@/lib/constant";

/**
 * The body of every 404. app/not-found.tsx wraps it in the header and footer
 * itself; (public)/not-found.tsx gets them from the (public) layout.
 */
export function NotFoundContent() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg space-y-8 text-center">
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">404</p>
          <h1 className="text-3xl font-bold tracking-tight">This page doesn&apos;t exist.</h1>
          <p className="text-muted-foreground">
            Wrong link, old bookmark, or a typo. Either way there&apos;s nothing here.
          </p>
        </div>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <TrackedLink href="/" cta="home" section="not_found">
            <Button className="w-full sm:w-auto">Back to the front page</Button>
          </TrackedLink>
          <TrackedLink href={docsLink} cta="docs" section="not_found" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="w-full sm:w-auto">
              Read the docs
            </Button>
          </TrackedLink>
        </div>
      </div>
    </div>
  );
}
