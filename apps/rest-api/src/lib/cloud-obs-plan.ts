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
