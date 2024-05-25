import authConfig from "./auth.config"
import NextAuth from "next-auth"
import { DEFAULT_LOGIN_REDIRECT, apiAuthPrefix, authRoutes, publicRoutes } from "@/routes";

const { auth: middleware } = NextAuth(authConfig)




export default middleware((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  if(process.env.NODE_ENV === "development") {
    console.log("isLoggedIn", isLoggedIn);
    console.log("Route: ", nextUrl.pathname);
  }

  const isApiAuthRoute = nextUrl.pathname.startsWith(apiAuthPrefix);
  const publicRoute = publicRoutes.includes(nextUrl.pathname);
  const authRoute = authRoutes.includes(nextUrl.pathname);

  if (isApiAuthRoute) {
    return;
  }

  if (authRoute) {
    if (isLoggedIn) {
      return Response.redirect(new URL(DEFAULT_LOGIN_REDIRECT, nextUrl));
    }
    return;
  }



  if (!isLoggedIn && !publicRoute) {
    return Response.redirect(new URL("/login", nextUrl));
  }

  return
});

// Optionally, don't invoke Middleware on some paths
export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
