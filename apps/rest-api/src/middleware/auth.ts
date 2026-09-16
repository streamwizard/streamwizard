// middleware/auth.ts
import type { Context, MiddlewareHandler, Next } from "hono";
import { setCookie } from "hono/cookie";
import { reportError } from "@repo/sentry";
import { createRequestClient, type RequestClient } from "@repo/supabase/request-client";

declare module "hono" {
  interface ContextVariableMap {
    supabase: RequestClient;
    user: {
      id: string;
      email?: string;
      [key: string]: any;
    } | null;
  }
}

/**
 * Get the Supabase client from context
 * Must be used after supabaseMiddleware() has been applied
 */
export const getSupabase = (c: Context) => {
  return c.get("supabase");
};

/**
 * Supabase SSR Middleware
 *
 * Creates a per-request Supabase client with cookie and Authorization header
 * handling. This middleware should be applied before routes that need Supabase.
 *
 * Handles authentication from:
 * - Authorization: Bearer <token> headers
 * - Cookies (for SSR)
 *
 * Usage:
 * ```typescript
 * app.use("/api/*", supabaseMiddleware());
 * ```
 */
export const supabaseMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    const supabase = createRequestClient({
      cookieHeader: c.req.header("Cookie"),
      authorizationHeader: c.req.header("Authorization"),
      // Same shape, two declarations: @supabase/ssr's options type is
      // cookie's SerializeOptions, hono's is its own copy of the same fields.
      setCookie: (name, value, options) => setCookie(c, name, value, options as Parameters<typeof setCookie>[3]),
    });

    c.set("supabase", supabase);

    await next();
  };
};

/**
 * Authentication Middleware
 * 
 * Verifies that the user is authenticated and sets the user in context.
 * Must be used after supabaseMiddleware().
 * 
 * Works with both Authorization headers and cookies.
 * 
 * Usage:
 * ```typescript
 * app.post("/api/clips/sync", supabaseMiddleware(), supabaseAuth(), async (c) => {
 *   const user = c.get("user");
 *   // user is guaranteed to exist here
 * });
 * ```
 */
export const supabaseAuth = (): MiddlewareHandler => {
  return async (c: Context, next: Next) => {
    const supabase = c.get("supabase");

    if (!supabase) {
      return c.json(
        {
          error: "Supabase client not initialized",
          message: "Internal server error",
        },
        500
      );
    }

    try {
      // Get user - SSR client will automatically use Authorization header or cookies
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        console.error("Auth error:", error.message, error.status);
        return c.json(
          {
            error: "Unauthorized",
            message: "Please sign in to access this resource",
            details: error.message,
          },
          401
        );
      }

      if (!user) {
        console.error("No user found in session");
        return c.json(
          {
            error: "Unauthorized",
            message: "Please sign in to access this resource",
          },
          401
        );
      }

      // Set user in context
      c.set("user", user);

      await next();
    } catch (error) {
      // Returned as a 500 rather than rethrown, so safeErrorHandler never sees
      // it — an auth middleware that is throwing on every request would look
      // like silence in Sentry without this.
      reportError(error, "auth.middleware");
      return c.json(
        {
          error: "Authentication failed",
          message: "Unable to verify authentication",
        },
        500
      );
    }
  };
};
