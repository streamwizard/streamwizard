export interface BannedChatter {
  id?: string;
  created_at?: Date;
  chatter_id: string;
  chatter_name: string;
  broadcaster_id: string;
  broadcaster_name: string;
  moderator_id: string;
  moderator_name: string;
  settings_id?: string;
  user_id?: string;
}
