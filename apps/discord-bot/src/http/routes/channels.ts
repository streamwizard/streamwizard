import { Hono } from "hono";
import { z } from "zod";
import { ChannelType, PermissionFlagsBits } from "discord.js";
import { markSelfAction } from "../../lib/server-log/self-actions";
import type { AppEnv } from "../types";
import { readJson } from "../validation";

export const channelRoutes = new Hono<AppEnv>();

// "Create a channel for me": a text channel members can read but
// not write in. 409 when the name is taken, so web-admin can say so inline.
channelRoutes.post("/channels", async (c) => {
  const body = z.object({ name: z.string().regex(/^[a-z0-9_-]{1,100}$/) }).safeParse(await readJson(c));
  if (!body.success) return c.json({ error: "Invalid body" }, 400);

  const guild = c.get("guild");
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return c.json({ error: "The bot needs the Manage Channels permission to create a channel." }, 409);
  }
  const channels = await guild.channels.fetch();
  if (channels.some((ch) => ch?.type === ChannelType.GuildText && ch.name === body.data.name)) {
    return c.json({ error: `#${body.data.name} already exists. Pick it from the list instead.`, code: "name_taken" }, 409);
  }

  const channel = await guild.channels.create({
    name: body.data.name,
    type: ChannelType.GuildText,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] },
      {
        id: me.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles,
        ],
      },
    ],
  });
  markSelfAction("channel", channel.id); // or the server log reports it as a staff action
  return c.json({ ok: true, channelId: channel.id, name: channel.name });
});
