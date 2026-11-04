import { Hono } from "hono";
import { rawBodyMiddleware } from "@/middleware/raw-body";
import { twitchEventSubVerification } from "@/middleware/twitch-eventsub";
import { handleTwitchEventSub } from "@/routes/twitch-eventsub";

// POST /webhooks/twitch/eventsub: Twitch's webhook transport. The raw body is
// kept for the signature check, which runs before the handler.
export const eventsubRoutes = new Hono();

eventsubRoutes.post("/", rawBodyMiddleware(), twitchEventSubVerification(), handleTwitchEventSub);
