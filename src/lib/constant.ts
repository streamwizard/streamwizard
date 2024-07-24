import Category from "@/components/icons/category";
import Logs from "@/components/icons/clipboard";
import Templates from "@/components/icons/cloud_download";
import Home from "@/components/icons/home";
import Payment from "@/components/icons/payment";
import Settings from "@/components/icons/settings";
import Workflows from "@/components/icons/workflows";
import { Actions } from "@/types/database";
import { Connection, EditorCanvasDefaultCardType } from "@/types/workflow";

export const clients = [...new Array(10)].map((client, index) => ({
  href: `/${index + 1}.png`,
}));

export const products = [
  {
    title: "Moonbeam",
    link: "https://gomoonbeam.com",
    thumbnail: "/p1.png",
  },
  {
    title: "Cursor",
    link: "https://cursor.so",
    thumbnail: "/p2.png",
  },
  {
    title: "Rogue",
    link: "https://userogue.com",
    thumbnail: "/p3.png",
  },

  {
    title: "Editorially",
    link: "https://editorially.org",
    thumbnail: "/p4.png",
  },
  {
    title: "Editrix AI",
    link: "https://editrix.ai",
    thumbnail: "/p5.png",
  },
  {
    title: "Pixel Perfect",
    link: "https://app.pixelperfect.quest",
    thumbnail: "/p6.png",
  },

  {
    title: "Algochurn",
    link: "https://algochurn.com",
    thumbnail: "/p1.png",
  },
  {
    title: "Aceternity UI",
    link: "https://ui.aceternity.com",
    thumbnail: "/p2.png",
  },
  {
    title: "Tailwind Master Kit",
    link: "https://tailwindmasterkit.com",
    thumbnail: "/p3.png",
  },
  {
    title: "SmartBridge",
    link: "https://smartbridgetech.com",
    thumbnail: "/p4.png",
  },
  {
    title: "Renderwork Studio",
    link: "https://renderwork.studio",
    thumbnail: "/p5.png",
  },

  {
    title: "Creme Digital",
    link: "https://cremedigital.com",
    thumbnail: "/p6.png",
  },
  {
    title: "Golden Bells Academy",
    link: "https://goldenbellsacademy.com",
    thumbnail: "/p1.png",
  },
  {
    title: "Invoker Labs",
    link: "https://invoker.lol",
    thumbnail: "/p2.png",
  },
  {
    title: "E Free Invoice",
    link: "https://efreeinvoice.com",
    thumbnail: "/p3.png",
  },
];

export const menuOptions = [
  { name: "Dashboard", Component: Home, href: "/dashboard" },
  { name: "Workflows", Component: Workflows, href: "/workflows" },
  { name: "Settings", Component: Settings, href: "/settings" },
  { name: "Connections", Component: Category, href: "/connections" },
  { name: "Billing", Component: Payment, href: "/billing" },
  { name: "Templates", Component: Templates, href: "/templates" },
  { name: "Logs", Component: Logs, href: "/logs" },
];

// twitch scopes
export const TWITCH_SCOPES = [
  "openid",
  "user:read:email",
  "channel:read:editors",
  "channel:manage:redemptions",
  "channel:read:subscriptions",
  "channel:read:vips",
  "moderation:read",
  "moderator:read:followers",
  "user:read:chat",
  "user:write:chat",
  "user:bot",
  "channel:bot",
];

interface IAction {
  name: string;
  value: Actions;
  user_input: boolean;
}

export const actions: IAction[] = [
  {
    name: "None",
    user_input: false,
    value: "none",
  },

  {
    name: "Song Request",
    value: "spotify.song_request",
    user_input: true,
  },

  {
    name: "Skip",
    value: "spotify.skip",
    user_input: false,
  },

  {
    name: "Ban Chatter",
    value: "spotify.add_banned_chatter",
    user_input: true,
  },

  {
    name: "Unban Chatter",
    value: "spotify.remove_banned_chatter",
    user_input: true,
  },

  {
    name: "Ban Song",
    value: "spotify.add_banned_song",
    user_input: true,
  },

  {
    name: "Unban Song",
    value: "spotify.remove_banned_song",
    user_input: true,
  },
];

export const EditorCanvasDefaultCard: EditorCanvasDefaultCardType = {
  Twitch: {
    Actions: [
      {
        title: "update channel points",
        description: "update channel points",
        completed: false,
        current: false,
        metadata: {},
        type: "Action",
      },
    ],
  },
  Discord: {
    Actions: []
  },
};

export const CONNECTIONS: Connection[] = [
  {
    title: "Discord",
    description: "Connect your discord to send notification and messages",
    image: "/discord.png",
    connectionKey: "discordNode",
    accessTokenKey: "webhookURL",
  },
];
