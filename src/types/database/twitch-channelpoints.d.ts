export type ChannelpointsDatabaseColumns = {
  id?: number; // Primary Key (int4)
  broadcaster_id: number; // varchar, not nullable (1)
  channelpoint_id: string;
  action: string
};
