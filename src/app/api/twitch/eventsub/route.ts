// app/api/twitch/eventsub/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { env } from "@/lib/env";
import handleStreamOffline from "@/server/twitch/eventsub/events/handle-stream-offline";

// Ensure TWITCH_WEBHOOK_SECRET is set in your .env
const TWITCH_SECRET = env.TWITCH_WEBHOOK_SECRET;

// Verify Twitch signature
function verifyTwitchSignature(messageId: string, timestamp: string, body: string, signature: string): boolean {
  if (!TWITCH_SECRET) throw new Error("TWITCH_WEBHOOK_SECRET not configured");

  const message = messageId + timestamp + body;
  const hmac = crypto.createHmac("sha256", TWITCH_SECRET).update(message).digest("hex");

  return signature === `sha256=${hmac}`;
}

export async function POST(request: NextRequest) {
  try {
    // Get headers
    const headers = Object.fromEntries(request.headers);
    const messageId = headers["twitch-eventsub-message-id"] as string;
    const timestamp = headers["twitch-eventsub-message-timestamp"] as string;
    const messageType = headers["twitch-eventsub-message-type"] as string;
    const signature = headers["twitch-eventsub-signature"] as string;

    // Get raw body
    const rawBody = await request.text();

    // Verify signature
    if (!verifyTwitchSignature(messageId, timestamp, rawBody, signature)) {
      return NextResponse.json({ message: "Invalid signature" }, { status: 403 });
    }

    // Parse body
    const body = JSON.parse(rawBody);

    // Handle verification request
    if (messageType === "webhook_callback_verification") {
      return new NextResponse(body.challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // Handle notifications
    if (messageType === "notification") {
      const { subscription, event } = body;

      switch (subscription.type) {
        case "stream.offline":
          handleStreamOffline(event);
          break;
        default:
          console.log("Unhandled event type:", subscription.type);
      }
    }

    return NextResponse.json({ message: "OK" }, { status: 200 });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
