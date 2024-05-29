import type { NextAuthConfig } from "next-auth";
import { env } from "./lib/env";
import jwt from "jsonwebtoken";
import TwitchProvider from "next-auth/providers/twitch";
import { TWITCH_SCOPES } from "./lib/constant";
import { SupabaseAdapter } from "@auth/supabase-adapter";

const { TWITCH_CLIENT_SECRET, NEXT_PUBLIC_TWITCH_CLIENT_ID, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, SUPABASE_JWT_SECRET } = env;

export default {
  providers: [
    TwitchProvider({
      clientId: NEXT_PUBLIC_TWITCH_CLIENT_ID,
      clientSecret: TWITCH_CLIENT_SECRET,
      authorization: {
        params: {
          scope: TWITCH_SCOPES.join(" "),
        },
      }, 
    }),
  ],

  adapter: SupabaseAdapter({
    url: SUPABASE_URL,
    secret: SUPABASE_SERVICE_ROLE_KEY,
  }),




} satisfies NextAuthConfig;
