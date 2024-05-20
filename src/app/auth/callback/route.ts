import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { add_twitch_integration, get_twitch_integration, update_twitch_integration } from "@/actions/admin/supabase";
import { Twitch_integration } from "@/types/database/user";
import axios from "axios";
import { GetEventSubSubscriptionsResponse, getConduitsResponse } from "@/types/API/twitch";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.delete({ name, ...options });
        },
      },
    });

    // get the access token and refresh token
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(`${origin}/auth/auth-code-error`);
    }

    // add the twitch integration to the database
    const { user, session } = data;

    const twitch_user: Twitch_integration = {
      user_id: user.id,
      account: user.user_metadata.full_name,
      broadcaster_id: +user.identities![0].id,
      access_token: session.provider_token!,
      refresh_token: session.provider_refresh_token!,
      email: user.user_metadata.email,
      beta_access: false,
      is_live: false,
    };

    // check if the user already has a twitch integration
    const existing_integration = await get_twitch_integration(user.id, user.identities![0].id);

    if (existing_integration === null) {
      await add_twitch_integration(twitch_user);
    } else {
      await update_twitch_integration(user.id, user.identities![0].id, twitch_user);
    }

    // subscribe to eventsub
    await EventSubscriptions(user.identities![0].id);
  }

  return NextResponse.redirect(`${origin}/dashboard`);

  // return the user to an error page with instructions
}

async function EventSubscriptions(broadcaster_id: string) {
  const eventSubscriptions = [
    {
      type: "stream.online",
      version: "1",
      condition: {
        broadcaster_user_id: broadcaster_id,
      },
    },
    {
      type: "stream.offline",
      version: "1",
      condition: {
        broadcaster_user_id: broadcaster_id,
      },
    },
    {
      type: "channel.chat.message",
      version: "1",
      condition: {
        broadcaster_user_id: broadcaster_id,
        user_id: broadcaster_id,
      },
    },
    {
      type: "channel.channel_points_custom_reward_redemption.add",
      version: "1",
      condition: {
        broadcaster_user_id: broadcaster_id,
      },
    },
    {
      type: "channel.channel_points_custom_reward.remove",
      version: "1",
      condition: {
        broadcaster_user_id: broadcaster_id,
      },
    },
  ];

  const subs = await axios.get<GetEventSubSubscriptionsResponse>("https://api.twitch.tv/helix/eventsub/subscriptions", {
    params: { user_id: broadcaster_id },
    headers: {
      "Client-ID": process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID!,
      Authorization: `Bearer ${process.env.TWITCH_APP_TOKEN!}`,
    },
  });

  // check for missing subscriptions
  const missingSubs = eventSubscriptions.filter((event) => {
    return !subs.data.data.some((sub) => sub.type === event.type);
  });

  if (missingSubs.length === 0) {
    console.log("All subscriptions are active");
    return;
  }

  // get the conduit id
  const res = await axios.get<getConduitsResponse>("https://api.twitch.tv/helix/eventsub/conduits", {
    headers: {
      "Client-ID": process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID!,
      Authorization: `Bearer ${process.env.TWITCH_APP_TOKEN!}`,
    },
  });

  if (res.data.data.length === 0) throw new Error("No conduits found");

  const conduit_id = res.data.data[0].id;

  await Promise.all(
    missingSubs.map(async (event) => {
      await axios.post(
        "https://api.twitch.tv/helix/eventsub/subscriptions",
        {
          ...event,
          transport: {
            method: "conduit",
            conduit_id: conduit_id,
          },
        },
        {
          headers: {
            "Client-ID": process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID!,
            Authorization: `Bearer ${process.env.TWITCH_APP_TOKEN!}`,
          },
        }
      );
    })
  );
}
