/**
 * Running instances whose owner no longer holds a Cloud OBS plan that may run
 * things (revoked, past_due, or a grant whose expiry has passed). The node
 * stops these on its plan sweep. `entitledUsers` must throw on a lookup
 * failure: an empty set would read as "nobody has a plan" and stop everything.
 */
export async function unentitledInstanceIds(
  instances: { id: string; user_id: string }[],
  entitledUsers: (userIds: string[]) => Promise<Set<string>>,
): Promise<string[]> {
  if (instances.length === 0) return [];
  const entitled = await entitledUsers([...new Set(instances.map((i) => i.user_id))]);
  return instances.filter((i) => !entitled.has(i.user_id)).map((i) => i.id);
}

/**
 * The Cloud OBS subscription a new instance runs under, checked on the server
 * whatever the node sends. A subscription id from the node must be the user's
 * own active Cloud OBS plan; with none, the user's active Cloud OBS plan is
 * used. Null means the user may not launch.
 */
export async function launchSubscriptionId(
  userId: string,
  sentSubscriptionId: string | null | undefined,
  lookups: {
    isOwnActivePlan: (subscriptionId: string, userId: string) => Promise<boolean>;
    activePlanOf: (userId: string) => Promise<string | null>;
  },
): Promise<string | null> {
  if (sentSubscriptionId) {
    return (await lookups.isOwnActivePlan(sentSubscriptionId, userId)) ? sentSubscriptionId : null;
  }
  return lookups.activePlanOf(userId);
}
