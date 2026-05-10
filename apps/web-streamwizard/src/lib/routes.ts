import { User } from "@supabase/supabase-js";

export interface RouteConfig {
  path: string;
  requireAuth?: boolean;
  requiredRoles?: string[];
  redirectPath?: string;
}

export const RESTRICTED_ROUTES: RouteConfig[] = [
  {
    path: "/dashboard",
    requireAuth: true,
    redirectPath: "/unauthorized",
  },
];

export function canAccessRoute(pathname: string, user: User | null): { allowed: boolean; redirectPath?: string } {
  const matchedRoute = RESTRICTED_ROUTES.find((route) => pathname.startsWith(route.path));

  if (!matchedRoute) return { allowed: true };

  if (matchedRoute.requireAuth && !user) {
    return {
      allowed: false,
      redirectPath: "/login",
    };
  }

  if (matchedRoute.requiredRoles) {
    const userRoles = user?.user_metadata?.roles || [];
    const hasRequiredRole = matchedRoute.requiredRoles.some((role) => userRoles.includes(role));

    return {
      allowed: hasRequiredRole,
      redirectPath: matchedRoute.redirectPath || "/unauthorized",
    };
  }

  return { allowed: true };
}

export function getRouteRedirect(pathname: string): string | undefined {
  const matchedRoute = RESTRICTED_ROUTES.find((route) => pathname.startsWith(route.path));
  return matchedRoute?.redirectPath;
}
