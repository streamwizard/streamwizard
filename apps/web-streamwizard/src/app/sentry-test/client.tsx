"use client";

import * as Sentry from "@sentry/nextjs";
import { throwServerError } from "./actions";

export function SentryTestButtons() {
  return (
    <div className="flex flex-col gap-3">
      {/* Client-side unhandled error */}
      <button
        className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        onClick={() => {
          throw new Error("Sentry test: unhandled client error");
        }}
      >
        Throw client error
      </button>

      {/* Manual captureException */}
      <button
        className="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
        onClick={() => {
          Sentry.captureException(new Error("Sentry test: manual captureException"));
          alert("Event sent — check Sentry dashboard");
        }}
      >
        Manual captureException
      </button>

      {/* Server action error */}
      <button
        className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
        onClick={async () => {
          await throwServerError();
        }}
      >
        Throw server action error
      </button>
    </div>
  );
}
