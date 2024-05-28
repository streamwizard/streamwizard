import jwt from "jsonwebtoken";
import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { env } from "./lib/env";
import axios from "axios";
import { TwitchEventSubscriptions } from "./lib/utils";
import { GetEventSubSubscriptionsResponse } from "./types/API/twitch";

const { SUPABASE_JWT_SECRET } = env;

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  // debug: true,
  callbacks: {
    async session({ session, user }) {
      const signingSecret = SUPABASE_JWT_SECRET;

      const payload = {
        aud: "authenticated",
        exp: Math.floor(new Date(session.expires).getTime() / 1000),
        sub: user.id,
        email: user.email,
        role: "authenticated",
      };
      session.supabaseAccessToken = jwt.sign(payload, signingSecret);

      return session;
    },

    signIn: async ({ account }) => {
      const hasEvents = await checkTwitchSubscriptions(account!.providerAccountId);

      if (!hasEvents) {
        return "/unauthorized?reason=missing_events";
      }


      return true
    },
  },
});

// check for missing twitch event subscriptions
async function checkTwitchSubscriptions(user_id: string): Promise<boolean> {
  try {
    const res = await axios.get<GetEventSubSubscriptionsResponse>("https://api.twitch.tv/helix/eventsub/subscriptions", {
      params: {
        user_id: user_id,
      },
      headers: {
        Authorization: `Bearer ${env.TWITCH_APP_TOKEN}`,
        "Client-Id": env.NEXT_PUBLIC_TWITCH_CLIENT_ID,
      },
    });

    const subscriptions = TwitchEventSubscriptions(user_id);

    const missingSubs = subscriptions.map((sub) => sub.type).filter((sub) => !res.data.data.some((data) => data.type === sub));

    if (missingSubs.length > 0) {
      await Promise.all(
        missingSubs.map((sub) =>
          axios.post(
            "https://api.twitch.tv/helix/eventsub/subscriptions",
            {
              ...subscriptions.find((subscription) => subscription.type === sub),
              transport: {
                method: "conduit",
                conduit_id: "87dd37b2-65fe-45a1-b9ad-07751cfeee3f",
              },
            },
            {
              headers: {
                Authorization: `Bearer ${env.TWITCH_APP_TOKEN}`,
                "Client-Id": env.NEXT_PUBLIC_TWITCH_CLIENT_ID,
              },
            }
          )
        )
      );
    }

    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}
