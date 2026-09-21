import { signOut } from "@/lib/auth-actions";

/**
 * Centred card used by the pre-dashboard pages (/login, /no-access,
 * /auth/verify, /auth/setup). Same look as the hand-rolled login card so the
 * whole sign-in journey reads as one surface.
 */
export function AuthShell({
  title,
  description,
  email,
  children,
  maxWidth = "max-w-sm",
}: {
  title: string;
  description?: string;
  /** When set, a "signed in as … / sign out" footer is shown. */
  email?: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className={`w-full ${maxWidth} space-y-6 rounded-xl border border-border bg-card p-8 shadow-sm`}>
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>

        {children}

        {email !== undefined && (
          <form action={signOut} className="flex items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
            <span className="truncate">
              Signed in as <span className="font-medium text-foreground">{email || "this account"}</span>
            </span>
            <button type="submit" className="shrink-0 underline-offset-4 hover:underline">
              Sign out
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
