import { SentryTestButtons } from "./client";

export default function SentryTestPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-8">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sentry Test Page</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Use these buttons to verify errors are reaching the Sentry dashboard.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Client errors</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Thrown in the browser — appear under the web-streamwizard project</p>
          </div>
          <SentryTestButtons />
        </div>

        <div className="rounded-lg border border-border bg-card p-6 space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Server error</h2>
          <p className="text-xs text-muted-foreground">Triggers a Next.js server component error, captured server-side</p>
          <form
            action={async () => {
              "use server";
              throw new Error("Sentry test: server component error");
            }}
          >
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Throw server component error
            </button>
          </form>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Remove this page before going to production.
        </p>
      </div>
    </div>
  );
}
