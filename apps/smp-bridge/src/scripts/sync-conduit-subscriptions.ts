import { TwitchApi } from "@repo/twitch-api";
import type { EventSubSubscriptionType } from "@repo/types";

type BroadcasterConfig = {
  broadcasterId: string;
  moderatorId?: string;
};

type TopicDefinition = {
  type: EventSubSubscriptionType;
  version: string;
  buildCondition: (broadcaster: BroadcasterConfig) => Record<string, string>;
};

type DesiredSubscription = {
  type: EventSubSubscriptionType;
  version: string;
  condition: Record<string, string>;
};

// -----------------------------------------------------------------------------
// EDIT THESE CONFIGS
// -----------------------------------------------------------------------------

const CONDUIT_ID = "6a9dfc09-7807-4f9d-830e-25f6ab00ed1f";

const BROADCASTERS: BroadcasterConfig[] = [
  { broadcasterId: "122604941" },
];

const TOPICS: TopicDefinition[] = [
  // {
  //   type: "stream.online",
  //   version: "1",
  //   buildCondition: ({ broadcasterId }) => ({
  //     broadcaster_user_id: broadcasterId,
  //   }),
  // },
  // {
  //   type: "stream.offline",
  //   version: "1",
  //   buildCondition: ({ broadcasterId }) => ({
  //     broadcaster_user_id: broadcasterId,
  //   }),
  // },
  // {
  //   type: "channel.update",
  //   version: "2",
  //   buildCondition: ({ broadcasterId }) => ({
  //     broadcaster_user_id: broadcasterId,
  //   }),
  // },
  {
    type: "channel.channel_points_custom_reward_redemption.add",
    version: "1",
    buildCondition: ({ broadcasterId }) => ({
      broadcaster_user_id: broadcasterId,
    }),
  },
];

// -----------------------------------------------------------------------------

const twitchApi = new TwitchApi();

function normalizeCondition(condition: Record<string, unknown>): string {
  return JSON.stringify(
    Object.keys(condition)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = condition[key];
        return acc;
      }, {}),
  );
}

function getSubscriptionKey(input: {
  type: string;
  version: string;
  condition: Record<string, unknown>;
}): string {
  return `${input.type}|${input.version}|${normalizeCondition(input.condition)}`;
}

function buildDesiredSubscriptions(): DesiredSubscription[] {
  const subscriptions: DesiredSubscription[] = [];
  const seen = new Set<string>();

  for (const broadcaster of BROADCASTERS) {
    for (const topic of TOPICS) {
      const desired = {
        type: topic.type,
        version: topic.version,
        condition: topic.buildCondition(broadcaster),
      };

      const key = getSubscriptionKey(desired);
      if (!seen.has(key)) {
        subscriptions.push(desired);
        seen.add(key);
      }
    }
  }

  return subscriptions;
}

async function syncSubscriptions(): Promise<void> {
  const desiredSubscriptions = buildDesiredSubscriptions();
  if (desiredSubscriptions.length === 0) {
    console.log("No desired subscriptions configured, skipping.");
    return;
  }

  const existing = await twitchApi.eventsub.getSubscriptions("system");
  const existingConduitSubscriptions = existing.data.filter(
    (subscription) =>
      subscription.transport.method === "conduit" &&
      subscription.transport.conduit_id === CONDUIT_ID,
  );

  const existingKeys = new Set(
    existingConduitSubscriptions.map((subscription) =>
      getSubscriptionKey({
        type: subscription.type,
        version: subscription.version,
        condition: subscription.condition,
      }),
    ),
  );

  let createdCount = 0;
  let skippedCount = 0;

  for (const desired of desiredSubscriptions) {
    const key = getSubscriptionKey(desired);

    if (existingKeys.has(key)) {
      skippedCount++;
      console.log(
        `Skip: ${desired.type} ${desired.version} ${normalizeCondition(desired.condition)}`,
      );
      continue;
    }

    await twitchApi.eventsub.createSubscription(
      {
        type: desired.type,
        version: desired.version,
        condition: desired.condition,
        transport: {
          method: "conduit",
          conduit_id: CONDUIT_ID,
        },
      },
      "system",
    );

    createdCount++;
    console.log(
      `Created: ${desired.type} ${desired.version} ${normalizeCondition(desired.condition)}`,
    );
  }

  console.log(
    `Subscription sync done. Created=${createdCount}, Skipped=${skippedCount}, Desired=${desiredSubscriptions.length}`,
  );
}

async function main() {
  console.log("Syncing conduit subscriptions...");
  await syncSubscriptions();

  console.log("Conduit sync complete.");
}

main().catch((error) => {
  console.error("Conduit sync failed:", error);
  process.exit(1);
});
