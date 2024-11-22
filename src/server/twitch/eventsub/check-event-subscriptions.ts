'use server';
import CreateEventSubSubscription from "./create-event-subscription";
import getSubscriptionFromTwitch from "./get-subscriptions-from-twitch";
import NeededEventSubscriptions from "./needed-event-subscriptions";

export default async function checkEventSubscriptions(twitchUserId: string) {
  try {
    const currentSubscriptions = await getSubscriptionFromTwitch(twitchUserId);
    const neededSubscriptions = await NeededEventSubscriptions(twitchUserId);

    console.log("currentSubscriptions", currentSubscriptions);

    console.log("neededSubscriptions", neededSubscriptions);

    const missingSubscriptions = neededSubscriptions.filter(
      (subscription) => !currentSubscriptions.some((current) => current.type === subscription.type && current.version === subscription.version)
    );

    console.log("missingSubscriptions", missingSubscriptions);

    if (missingSubscriptions.length > 0) {
      await Promise.all(
        missingSubscriptions.map(async (subscription) => {
          await CreateEventSubSubscription(subscription);
        })
      );
    }
  } catch (error) {
    console.error(error);
    console.error("Error checking or creating event subscriptions:", error);
    // Handle the error (e.g., show a toast notification or retry the operation)
  }
}
